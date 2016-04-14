Title: EuroSciPy 2014 Thoughts
Date: 2014-09-05
Category: misc
Tags: SciPy, Python, open source
Slug: EuroSciPy2014


I just got back from Cambridge, where last week I attended [EuroSciPy](https://www.euroscipy.org/).  It was by far one of the best conferences I've ever attended and, from my point of view, the organizers basically did everything right.  I wanted to draw some sort of best practices, in the hope that other organizers try to imitate what works.

Best Conference Practices:
--------------------------

- **The organizers didn't attempt to pack too many talks every day.**  Most days, talks finished around 5:30 PM, leaving lots of time for people to hang out and get to know each other.  Conferences that last until 7PM, with evening sessions after dinner result in massive burnout by the end of the conference.

- **The conference was very cheap.**  Due to generosity of the sponsors and the excellent organization, the academic price for the full registration (including tutorials) was 100 pounds for a 4 day conference.  Cambridge was also an excellent location - flying to Stanstead is easy, and the various colleges around town offered cheap accomodation during the off-school period.

- **A very good mix of talks**.  There was a lot of spotlight for packages used by almost everyone in the scientific community (iPython, scikit-learn, etc) as well as some great talks on some incredibly impressive packages that I'd never heard about before (more on that later).

- **Everyone was so damn nice**.  Seriously - even though the community was quite small, as a relative outsider, it didn't feel cliqueish at all, and at the sprints and the social events everyone was very welcoming.


Here are a few of the packages that caught my eye.

New Packages:
-------------

- [Biguss](https://github.com/SciTools/biggus/).  This is a generalization of numpy to handle data which is too big to fit into memory using delayed evaluation.  It's very similar in spirit to Blaze by Continuum, but it's less ambitious and more mature.

- The optimization tools, and the HPC tools presented by Mike McKerns (https://github.com/uqfoundation).  Mystic looks very interesting (although the documentation is still a bit incomplete) but Dill (a better pickle that handles lots of objects that pickle cannot) and Pathos (a better multiprocessing) I will definitely incorporate into my workflow.  Mike did an excellent work of building tools that work very well together, but are worth using individually, which is a very difficult task that requires a lot of thought about API design and interoperability.

- [Firedrake](https://github.com/firedrakeproject/firedrake).  This is an incredible tool for largescale PDE systems.  The talk by Florian Rathgeber showing off the Firedrake architecture, and how the tool was built on several layers to allow people from different backgrounds to contribute was great.  One issue with the technology that was presented is the team made a lot of effort into separating all the various layers, but they are interlocking enough that it's difficult to use them individually.

- [Julia](http://julialang.org/).  The keynote by Steven Johnson was very impressive, and some of the things he implemented in there using metaprogramming to achieve greater than Fortran speed by inlining large polynomials seemed almost like black magic.  One of the biggest barriers that new languages face is the lack of a stable ecosystem, but [PyCall](https://github.com/stevengj/PyCall.jl) (also by Steven Johnson) makes calling Python packages from Julia a breeze - and it does so without message passing across a Python interpreter (like RPy2 or matlab-bridge do), but through some really clever c-api hacks.  I blogged about this earlier (http://federicov.github.io/Blog/Julia-and-Scientific-Python.html):

- [Sumatra](https://pythonhosted.org/Sumatra/).  If you've ever written code to do numerical simulations which is rapidly in flux, you've probably used an unearthly combination of log files, subdirectories, and commit logs to keep track of which simulation was done with what parameters and what version of the code.  Sumatra wraps this all up in a very nice interface, and it takes very little modification to get it to work with an existing codebase.  I had already heard it mentioned on twitter, but the lightning talk showed how quick and easy to use it is, which definitely sold me on it.

- [Scikit-theano](https://github.com/sklearn-theano/sklearn-theano).  This is a nice package by Kyle Kastner to expose some complex estimators that are currently outside of the scope of the main scikit-learn project using a sklearn-like api, while using Theano under the hood for speed.  Anyone who is familiar with the sklearn API should be able to use it.