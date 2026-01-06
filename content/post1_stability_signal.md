Title: Semantic Entropy as a Regularizer for LLM Calibration
Date: 2026-01-03  
Category: Machine Learning  
Tags: rlhf, uncertainty
Slug: uncertainty-calibration-pt1

This post explores using semantic entropy as a training signal for calibrating confidence in language models.

Here is what I found:

1. Training on semantic entropy alone does not converge and leads to unstable behavior  
2. In a data abundant/compute scarce regime, standard Brier score supervision achieves strong calibration on its own  
3. In a data-scarce regime, semantic entropy prevents catastrophic collapse under repeated training on limited labelled data
4. The model learns to say 'I don't know' - without ever being rewarded for it.

Code available [here](https://github.com/FedericoV/semantic-entropy)

---

## Why Calibration Matters

Large language models are increasingly used in scientific and technical workflows. In these settings, calibration matters because it determines how much you should trust what the model says. Most recent work focuses on making models smarter. Calibration is a different problem, and it's underexplored.

Experimental design depends on managing the explore exploit tradeoff. Confidence estimates influence whether a system commits to existing hypotheses or allocates resources toward uncertain but potentially informative directions.  In scientific workflows, calibration matters because experiments are expensive: gathering a single label might cost days of lab time or thousands of dollars in materials. As anyone who has worked seriously in science knows, asking questions is easy: answering them is the hard part. This asymmetry creates demand for training procedures that can extract signal from unlabeled questions while conserving labeled supervision.

Large language models exhibit characteristic failures in this respect. Their outputs are often fluent and informative, yet their stated confidence correlates weakly with correctness on out of distribution or frontier problems. This is why people have started working on inference-time uncertainty estimation, including approaches based on self consistency and semantic entropy (Kuhn et al., 2023), which provide empirical proxies for uncertainty without additional supervision.

A parallel line of work has explored uncertainty quantification in reward models for RLHF (Gleave et al., 2022; Lou et al., 2024; Banerjee et al., 2024), showing that variance-aware optimization improves alignment outcomes. The focus here is complementary: rather than quantifying uncertainty in the reward signal, I use behavioral consistency as a training signal for the policy's expressed confidence. They experiments here were carried out in short intervals, often while holding a sleeping infant (reader, please be gentle towards all the errors I missed), but are motivated by a broader interest in making language models more effective components in scientific decision making pipelines.

---

## Semantic Entropy as a Calibration Constraint

We can ask a language model the same question many times, and look at the distribution of answers it produces on each independent roll out.

Given $N$ rollouts that produce answers falling into $K$ distinct clusters with counts $n_1, n_2, \ldots, n_K$, stability is defined as one minus normalized entropy:

$$
\text{Stability} = 1 - \frac{H}{H_{\max}}
$$

where

$$
H = -\sum_{k=1}^{K} \frac{n_k}{N} \log \frac{n_k}{N}
\quad \text{and} \quad
H_{\max} = \log N
$$

Stability equals one when all rollouts agree and zero when all rollouts disagree. I implemented clustering with simple string-matching heuristic.
### Entropic constraint on correctness

Stability is not a direct estimate of correctness, but it does impose a constraint on how likely the model can be correct.

Let $\pi_\theta(y \mid x)$ denote the model's distribution over answers $y$ given question $x$. Let $y^*$ be the correct answer, with probability of correctness

$$
p_{\text{correct}} = \pi_\theta(y^* \mid x).
$$

Let

$$
p_{\max} = \max_y \pi_\theta(y \mid x)
$$

be the probability assigned to the modal answer. By definition,

$$
p_{\text{correct}} \le p_{\max}.
$$

The entropy of $\pi_\theta$ provides a loose upper bound on $p_{\max}$. High entropy implies that probability mass is spread across many answers, which limits how large $p_{\max}$ can be. Consequently,

$$
\text{Low Stability} \;\; \Rightarrow \;\; \text{Low } p_{\max} \;\; \Rightarrow \;\; \text{Low } p_{\text{correct}}.
$$

This implication is one-directional. High stability permits high correctness but does not guarantee it, since the modal answer need not be the correct one.

This asymmetry explains why stability functions as a useful regularizer but fails as a standalone training objective. When stability is low, high confidence is inconsistent with the model's own distribution. When stability is high, correctness still depends on whether the modal answer aligns with ground truth.

### Operationalizing calibration

This constraint can be incorporated into training by encouraging the model's stated confidence to match its observed stability.

Let $c \in [0,1]$ denote the model's stated confidence and let $y \in \{0,1\}$ indicate correctness. With labeled data, calibration can be trained using the Brier score:

$$
R_{\text{labeled}} = 1 - (y - c)^2.
$$

Without labels, correctness can be replaced by empirical stability $s \in [0,1]$ computed across rollouts:

$$
R_{\text{unlabeled}} = 1 - (s - c)^2.
$$

The labeled term encourages the modal answer to align with the ground truth. The stability term constrains confidence to respect the entropic limits of the current policy. Together, they form a mixed objective in which stability acts as a regularizer rather than a substitute for supervision.

Calibration is evaluated using the calibration gap,

$$
\text{Calibration Gap} = \bar{c} - \text{Accuracy},
$$

where positive values indicate overconfidence. A perfectly calibrated model would have a gap of zero.


---

## Why RL? The Moving Target Problem

A natural question is why we need Reinforcement Learning at all. Why not simply construct a dataset of questions, measure the model's accuracy on them *a priori*, and create a supervised dataset labeled with the appropriate confidence levels?

The issue is that calibration is **self-referential and dynamic**. The "correct" confidence level depends on the model's *current* ability to answer the question, which is exactly what we are changing during training.

In a static SFT regime, we would optimize against a fixed target $c^*$ determined by a snapshot of the model:

$$ \mathcal{L}_{\text{SFT}} = - \mathbb{E}_{(x, c^*) \sim \mathcal{D}} [ \log \pi_\theta(c^* | x) ] $$

However, true calibration requires that the stated confidence $c$ tracks the model's actual reliability under its current policy $\pi_\theta$:

$$ c \approx P(y \text{ is correct} | x, \pi_\theta) $$

Because we are updating $\theta$, the term on the right-hand side changes throughout training. If the model learns a new reasoning pattern that makes it more likely to answer correctly, its "ground truth" confidence *should* increase. If we locked it to a pre-computed $c^*$ from the beginning of training, we would be penalizing the model for becoming more capable (or more cautious). Note that this is true even if the model doesn't learn any new facts: the model becoming more aware of its ignorance is sufficient to invalidate any static labels.

We cannot encode this dynamic relationship in a static dataset. We must sample from the current policy ($y, c \sim \pi_\theta$), observe the actual correctness, and provide feedback via a proper scoring rule. This dependency on the current policy's performance makes it an inherently on-policy Reinforcement Learning problem.

---

## Sanity Check: Stability Predicts Correctness

Before using stability as a training signal, I checked that it actually predicts correctness here.

Using Qwen3-4B-Instruct on 150 TriviaQA questions with eight rollouts per question, I asked the model to try to answer every question, as well as its confidence.

| Metric | Correlation with Accuracy |
|--------|---------------------------|
| Stability | r = 0.48 |
| Stated Confidence | r = 0.12 |

Stability predicts correctness much better than the model's stated confidence.

![Stability vs confidence as predictors of accuracy]({static}/images/entropic_rl_pt1/fig1_correlation_comparison.svg)

---

## The Trap of Pure Stability

I really wanted this to work without labels because lazy supervision is the dream, but alas...

The calibration gap oscillates substantially across training, moving between overconfidence and underconfidence without settling. Without a ground truth anchor, the objective drifts. The model can satisfy the stability reward by becoming consistently wrong, remaining stable in its errors while maintaining high confidence. Stability alone is not a sufficient training signal. (See Figure 2a below.)

---

## With Abundant Labels, Just Use Brier

I ran a controlled ablation on 5000 TriviaQA questions under three conditions:

| Condition | Labels Used | Eval Accuracy | Calibration Gap |
|-----------|-------------|---------------|-----------------|
| 100% Brier | 100% | 44.9% | +5.2% |
| 50/50 Mixed | 50% | 42.3% | +13.0% |
| 100% Stability | 0% | 40.6% | +21.9% |

When labeled data is abundant and we are in a compute bound regime, pure Brier supervision achieves the best accuracy and calibration. Adding stability does not improve performance and slightly degrades it. In this regime, the correct conclusion is straightforward: if labels are available, they should be used directly.

---

## The Sweet Spot: Stability as a Regularizer

The most informative behavior appears when labeled data is limited and models are trained for multiple epochs.

I repeated the training on a reduced pool of 1600 questions:

| Run | Data | Reward | Epochs | Eval Accuracy | Calibration Gap |
|-----|------|--------|--------|---------------|-----------------|
| A | 1,600 | 100% Brier | 1 | 49.7% | +30.0% |
| B | 1,600 | 100% Brier | 2 | 31.5% | +5.7% |
| C | 1,600 | 50% Brier, 50% Stability | 2 | 43.6% | +11.4% |

Run B exhibits catastrophic collapse. After a second epoch of training on limited data, accuracy drops by eighteen points. The model overfits the training set and loses general knowledge. Note that this is in spite of doing training with LORA rank of 1! A single pass over the data in the absence of further regularization is enough to cause overfitting.

Run C does not collapse. With stability mixed into the objective, accuracy remains substantially higher. The only difference between the runs is the presence of the stability reward.

![Training dynamics under limited data. (a) Pure stability reward produces oscillatory behavior and fails to converge. (b) Adding stability as a regularizer to Brier supervision prevents catastrophic collapse under repeated training on limited data. Stability does not replace labels, but constrains training dynamics when labels are scarce.]({static}/images/entropic_rl_pt1/fig2_combined_training_dynamics.svg)

### Interpreting Apparent Calibration

Run B appears well calibrated according to the calibration gap metric, but this is misleading. The model becomes broadly underconfident while also becoming worse at the task.

Run C maintains higher accuracy while expressing lower confidence where appropriate. In this regime, stability functions as a regularizer that constrains the ways in which the model can game the objective.

This is the regime where the asymmetry described earlier becomes relevant. If labels are expensive and questions are cheap, you cannot simply collect more labeled data. But you can generate unlabeled questions at near-zero cost. Stability provides a way to extract training signal from those questions, allowing longer training without the collapse that pure supervision produces.

---

## Behavioral Effects on Reasoning

The numbers don't tell the whole story. Here's what the reasoning traces actually look like before and after training:

### Example 1: Mentioning Alternatives Without Committing

**Question:** Who is the patron saint of dancers?

**Baseline (85% confidence, wrong):**
> The patron saint of dancers is Saint Genevieve. She is traditionally associated with dancers, especially in France... But the most accurate answer specifically for dancers is Saint Genevieve.

**Trained (60% confidence, wrong):**
> The patron saint of dancers is Saint Genevieve... However, it's worth noting that Saint Vitus is also sometimes associated with dancers, especially in the context of St. Vitus' Dance. But the most commonly accepted patron saint specifically of dancers is Saint Genevieve.

The trained model gives the same wrong answer, but mentions the correct one (Saint Vitus) as an alternative. The confidence drops by 25 points. This is not an improvement in accuracy, but it is an improvement in epistemic honesty. The uncertainty is present in the reasoning, not only in the scalar confidence value.

### Example 2: Refusing to Guess

**Question:** Which Gilbert and Sullivan operetta is subtitled 'The Witch's Curse'?

**Baseline (90% confidence, wrong):**
> Upon closer inspection, the operetta that is sometimes unofficially referred to as "The Witches Curse" is actually "The Sorcerer"... Therefore, despite the lack of an official subtitle, "The Sorcerer" is the operetta most commonly associated with that nickname.

**Trained (70% confidence, abstains):**
> There is no Gilbert and Sullivan operetta officially subtitled "The Witches Curse." This may be a confusion with another work or a misattribution... Therefore, the correct answer is that no Gilbert and Sullivan operetta is officially subtitled "The Witches Curse."

The baseline confabulates an answer with high confidence. The trained model recognizes that it cannot find a confident answer and says so, returning "None" with appropriately lower confidence. Both are wrong (the answer is Ruddigore), but the trained model's response is more useful. It signals uncertainty rather than false certainty.


### Summary

| Behavior | Baseline | Trained |
|----------|----------|---------|
| Confidence when correct | 95 to 98 percent | 80 to 90 percent |
| Confidence when wrong | 85 to 95 percent | 60 to 70 percent |
| Mentions alternatives | Rare | Common |
| Abstains when uncertain | Never | Sometimes |

The model doesn't just output lower number: it actually reasons differently. It learns to hedge when uncertain, to mention alternatives it is not committing to, and occasionally to decline answering rather than confabulate.

This suggests that the mixed objective is not just rescaling confidence values, but is altering the model's internal decision threshold for committing to an answer. When the model's posterior over answers is sufficiently diffuse, producing any specific answer would require overstating confidence. Under the stability regularized objective, abstention becomes the least inconsistent action, even though it is formally penalized as wrong.

---

## Prompting as a Baseline

Can you just prompt for this?  I tested an aggressive calibration prompt that told the model to express uncertainty conservatively and avoid overconfidence.

| Approach | Calibration Gap | Reduction from Baseline |
|----------|-----------------|-------------------------|
| Untrained | +48.5% | — |
| Aggressive Prompting | +35.1% | 27% |
| RL Training | +11.7% | 76% |

Prompting improves calibration, but the effect is substantially smaller than that achieved through training. The trained model remains calibrated even under greedy decoding.

![RL training vs prompting comparison]({static}/images/entropic_rl_pt1/fig8_rl_vs_prompting.svg)

---

## Scope and Limitations

A few limitations!  This was a project I did to explore some ideas I find interesting, and to see how quickly I could iterate on a greenfield project using Gemini and Claude.

Here's what I'm actually claiming:

- The difference between pure Brier and mixed training under data scarcity is large enough to be meaningful  
- Stability prevents collapse when models are trained repeatedly on limited labeled data  
- Training time objectives outperform prompting for calibration  

Several aspects remain open:

- The optimal mixing ratio was not exhaustively explored  
- Results are based on single runs per condition  
- Generalization to other models and datasets remains to be tested
- Dataset augmentation by asking the same question in multiple ways to elicit increased entropy  
- Curriculum learning: mixing proportions of labeled / unlabeled data as training continues
- Prompt optimization
- Exploring different kinds of reasoning models
- Testing different uncertainty types: for example, requiring the model to predict confidence intervals for "Fermi estimation" type problems.

---

## Summary

| Finding | Implication |
|--------|-------------|
| Stability predicts accuracy better than stated confidence | The signal is present but unused |
| Pure stability reward fails | Ground truth anchoring is required |
| Brier dominates with abundant data | Labels should be used directly |
| Stability prevents collapse under scarcity | Acts as a regularizer |
| Training outperforms prompting | Calibration requires shaping behavior |

Semantic entropy is neither a universal solution nor a replacement for labeled supervision. Its value lies in constraining training dynamics when labeled data is limited and models are trained for multiple epochs. In this regime, it helps preserve general knowledge while improving the alignment between confidence and behavior.

The finding I keep coming back to: the model learns to say "I don't know." We penalized that as wrong, and it learned to do it anyway. That's what I want from a model in a scientific workflow: not higher accuracy, but honest uncertainty.

---

## References

- Banerjee, S. et al. (2024). Towards Reliable Alignment: Uncertainty-aware RLHF. *arXiv preprint*.
- Gleave, A. et al. (2022). Uncertainty Estimation for Language Reward Models. *arXiv preprint*.
- Kuhn, L. et al. (2023). Semantic Uncertainty: Linguistic Invariances for Uncertainty Estimation in Natural Language Generation. *ICLR 2023*.
- Lou, R. et al. (2024). Uncertainty-aware Reward Model: Teaching Reward Models to Know What is Unknown. *arXiv preprint*.