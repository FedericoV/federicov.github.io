Title: Using semantic entropy to calibrate confidence
Date: 2026-01-03
Category: Machine Learning
Tags: rlhf, uncertainty
Slug: uncertainty-calibration-pt1



# Semantic Entropy as a Training Signal: When It Works, When It Fails, and Why It Prevents Collapse

I tried to train a language model to be calibrated using only unlabeled data. It failed.

But when I ran controls to understand why, I found something more interesting: semantic entropy isn't a better training signal than ground truth labels—it's a *regularizer* that prevents catastrophic collapse when labels are scarce.

This post covers three findings:
1. Pure semantic entropy reward oscillates and fails to converge
2. With abundant labeled data, Brier score alone achieves near-perfect calibration
3. With scarce data, semantic entropy prevents the model from collapsing—not by being a better signal, but by preventing overfitting

## Background: Semantic Entropy in 60 Seconds

When you ask a language model the same question multiple times with temperature sampling, sometimes it gives consistent answers and sometimes it doesn't. This consistency—or lack thereof—is called *semantic entropy* or *stability*.

Kuhn et al. (2023) showed that stability predicts correctness: when a model gives the same answer across multiple samples, it's more likely to be right. Prior work uses this at inference time to flag uncertain predictions.

The natural question: what happens if we turn this diagnostic into a training signal?

## The Core Idea: Confidence Should Match Stability

The intuition is simple:
- If the model is unstable across rollouts → it should say it's uncertain
- If it's stable → it should commit

We can formalize this with two reward functions:

```
R_labeled   = 1 - (correct - confidence)²     # Brier score (needs labels)
R_unlabeled = 1 - (stability - confidence)²   # Match your instability (no labels needed)
```

The Brier score rewards the model for being confident when correct and uncertain when wrong. The stability reward asks: "does your stated confidence match how consistent you actually are?"

The appeal is obvious: if stability reward works, we can train calibrated models without expensive human labels.

## Act 1: Replication — Stability Predicts Correctness

Before trying to train with stability, I verified that it actually predicts correctness. Using Qwen3-4B-Instruct on 150 TriviaQA questions with 8 rollouts each:

| Metric | Correlation with Accuracy |
|--------|---------------------------|
| Stability | r = 0.48 |
| Stated Confidence | r = 0.12 |

Stability is 4x more predictive than stated confidence. The model "knows" when it's uncertain—it just doesn't say so.

This isn't new, but it matters for what comes next.

![Stability vs confidence as predictors of accuracy]({static}/images/entropic_rl_pt1/fig1_correlation_comparison.svg)

## Act 2: Pure Stability Fails

Armed with this correlation, I tried training with 100% stability reward (no labels at all). It didn't work.

The calibration gap oscillated wildly: +44% → +14% → +22%. Without a ground truth anchor, the signal drifts. The model can satisfy the stability reward by being *consistently wrong*—stable in its errors but still overconfident.

![Training curves showing oscillation in 100% stability condition]({static}/images/entropic_rl_pt1/fig2_training_curves.svg)

Stability alone is not sufficient. It needs grounding.

## Act 3a: With Abundant Data, Brier Wins

I ran a proper ablation with three conditions on 5000 TriviaQA questions:

| Condition | Labels Used | Eval Accuracy | Calibration Gap |
|-----------|-------------|---------------|-----------------|
| 100% Brier | 100% | **44.9%** | **+5.2%** |
| 50/50 Mixed | 50% | 42.3% | +13.0% |
| 100% Stability | 0% | 40.6% | +21.9% |

When data is abundant, pure Brier wins on both accuracy and calibration. Stability doesn't help—it actually hurts slightly.

This was disappointing. If you have labels, just use them. Stability adds nothing.

![Ablation results with abundant data]({static}/images/entropic_rl_pt1/fig3_ablation_bars.svg)

## Act 3b: The Collapse Finding

But then I ran a different experiment. What happens when data is *scarce*?

I restricted the training pool to 1,600 questions and compared:

| Run | Data | Reward | Epochs | Eval Accuracy | Calibration Gap |
|-----|------|--------|--------|---------------|-----------------|
| A | 1,600 | 100% Brier | 1 | 49.7% | +30.0% |
| B | 1,600 | 100% Brier | 2 | **31.5%** | +5.7% |
| C | 1,600 | 50% Brier, 50% Stability | 2 | **43.6%** | +11.4% |

Run B collapsed. When training for a second epoch on limited data with pure Brier reward, accuracy dropped from 49.7% to 31.5%—an 18 point collapse.

Run C didn't collapse. With stability reward mixed in, accuracy stayed at 43.6%.

Same data. Same compute. Only difference: `labeled_fraction`.

**Result: +12.1% accuracy difference.**

![Stability prevents collapse on limited data]({static}/images/entropic_rl_pt1/fig9_stability_as_regularizer.svg)

### Why Run B's "Good" Calibration Is Misleading

Run B's +5.7% calibration gap looks great on paper. But look at the numbers: 37.2% confidence on 31.5% accuracy.

The model became bad at everything AND underconfident. That's not calibration—it's collapse. The model learned to "game" the Brier score on training data by being uncertain about everything.

Run C achieved genuine calibration: 43.6% accuracy with 54.9% confidence. The model retained its knowledge while becoming more calibrated.

### The Interpretation

I thought stability was about label efficiency. It's actually about regularization.

When you train on limited data for multiple epochs, pure Brier overfits catastrophically. The model memorizes the training set and loses its general knowledge. Stability prevents this—not by being a better signal, but by preventing the model from gaming the objective.

The stability reward says: "match your confidence to your consistency." This is a constraint the model can't easily game by memorizing answers. It has to maintain coherent uncertainty across samples.

## What Changes in the Reasoning?

Numbers are useful, but they don't show *how* the model's thinking changes. I saved traces from before and after training to compare reasoning patterns.

### Example 1: Mentioning the Right Answer Without Committing

**Question:** "Who is the patron saint of dancers?"

**Baseline (wrong, 85% confidence):**
> The patron saint of dancers is Saint Genevieve. She is traditionally associated with dancers, especially in France... However, there is some confusion, as Saint Cecilia is more commonly recognized as the patron saint of music and musicians...

**Trained (wrong, 60% confidence):**
> The patron saint of dancers is Saint Genevieve... However, it's worth noting that **Saint Vitus is also sometimes associated with dancers**, especially in the context of St. Vitus' Dance... But the most commonly accepted patron saint specifically of dancers is Saint Genevieve.

The correct answer is St. Vitus. The trained model *mentions* the right answer but doesn't commit to it. This is epistemic honesty—the model surfaces its uncertainty by hedging, and the lower confidence (60% vs 85%) reflects that hedge.

### Example 2: Refusing to Guess

**Question:** "Which Gilbert and Sullivan operetta is subtitled 'The Witch's Curse'?"

**Baseline (wrong, 90% confidence):**
> ...upon closer inspection, the operetta that is sometimes unofficially referred to as "The Witches Curse" is actually "The Sorcerer"... Therefore, despite the lack of an official subtitle, "The Sorcerer" is the operetta most commonly associated with that nickname.

**Trained (abstains, 70% confidence):**
> ...There is no Gilbert and Sullivan operetta officially subtitled "The Witches Curse." This may be a confusion with another work or a misattribution... Therefore, the correct answer is that no Gilbert and Sullivan operetta is officially subtitled "The Witches Curse."

The trained model refuses to guess. Instead of confabulating a plausible-sounding answer, it says "None"—which is wrong (the answer is Ruddigore), but the *behavior* is more honest. The model learned that when it can't find a confident answer, abstention is better than fabrication.

### Example 3: Calibrated Confidence on Easy Questions

**Question:** "What general name is given to a rotating star which emits a regular beat of radiation?"

**Baseline (correct, 98% confidence):**
> This phenomenon is characteristic of neutron stars, specifically a subclass known as pulsars. The general name for such an object is a "pulsar."

**Trained (correct, 85% confidence):**
> A rotating star that emits a regular beat of radiation is known as a pulsar... The term "pulsar" is short for "pulsating star."

Both get it right, but the trained model is less overconfident. 98% confidence implies near-certainty—but the model can't really be 98% sure about anything from its training data. 85% is more honest.

### Example 4: Lower Confidence When Wrong

**Question:** "Who was the Conservative candidate beaten by Ken Livingstone in the first two elections for Mayor of London?"

**Baseline (correct, 95% confidence):**
> ...The correct answer is that in the first election (2000), the Conservative candidate was Steve Norris.

**Trained (wrong, 70% confidence):**
> ...Therefore, the only Conservative candidate beaten by Livingstone in the first two elections was Boris Johnson.

The trained model gets this wrong, but expresses lower confidence (70% vs 95%). The reasoning shows genuine confusion—the model gets tangled up in facts about different elections. Importantly, *it expresses that confusion in its confidence score*.

### The Pattern

Across these examples, a consistent pattern emerges:

| Behavior | Baseline | Trained |
|----------|----------|---------|
| Confidence when correct | 95-98% | 80-90% |
| Confidence when wrong | 85-95% | 60-70% |
| Mentions alternatives | Rarely | Often |
| Abstains when uncertain | Never | Sometimes |

The trained model didn't just learn to output lower numbers. It learned a *reasoning style* that expresses uncertainty through hedging, alternatives, and abstention. The confidence scores reflect the actual uncertainty in the text.

## "Can't You Just Prompt It?"

A reasonable objection: maybe you don't need RL training at all. Just prompt the model to be more calibrated.

I tested this with an aggressive calibration prompt that explicitly instructed the model to be honest about uncertainty, express lower confidence when unsure, and avoid overconfidence.

| Approach | Calibration Gap | Reduction from Baseline |
|----------|-----------------|-------------------------|
| Untrained | +48.5% | — |
| Aggressive Prompting | +35.1% | 27% |
| RL Training | +11.7% | **76%** |

RL training is 3x more effective than prompt engineering. The trained model achieves +11.7% gap at temperature 0 (greedy decoding), while even aggressive prompting only gets to +35.1%.

![RL training vs prompting comparison]({static}/images/entropic_rl_pt1/fig8_rl_vs_prompting.svg)

## Limitations

I want to be explicit about what this work does and doesn't show:

**What we can claim:**
- Run B vs Run C: +12.1% accuracy difference—too large to be noise
- Stability prevents collapse on limited data
- RL training significantly outperforms prompting for calibration

**What requires hedging:**
- Precise optimal mixing ratios (we tested 50/50, not a full sweep)
- Generalization to other models and datasets
- Single runs per condition (no error bars)

**Conceptual limitations:**
- Stability ≠ epistemic uncertainty. A model can be stably wrong—consistent in its errors. Stability measures behavioral consistency, not knowledge.
- This is calibration, not correctness. A well-calibrated model that's 40% accurate is still only 40% accurate.

## Summary

| Finding | Implication |
|---------|-------------|
| Stability predicts accuracy 4x better than stated confidence | The model "knows" its uncertainty but doesn't express it |
| Pure stability reward oscillates | Needs ground truth anchor to converge |
| With abundant data, Brier wins | Just use labels if you have them |
| With scarce data, stability prevents collapse | Acts as regularizer, not better signal |
| RL training >> prompting | 76% vs 27% gap reduction |

The bottom line: semantic entropy as a training signal isn't universally better or worse than Brier. It serves a specific purpose—**regularization in data-scarce regimes**. When you have abundant unique data, just use Brier. When you're training on limited data for multiple epochs, add stability to prevent overfitting.

## What's Next

This raised a deeper question for me: uncertainty isn't just across answers—it lives *inside* reasoning.

When a model works through a multi-step problem, uncertainty can arise at any step. If one step in a proof is shaky, the model shouldn't be 99% confident in the conclusion.

In the next post, I'll explore training models to propagate uncertainty through their chains of thought—and discover why Brier score alone completely fails in this setting.

---

*Code and experiments: [github.com/your-repo/entropic-rl](https://github.com/your-repo/entropic-rl)*

*Built with [Tinker](https://thinkingmachines.ai) for RL training.*