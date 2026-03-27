---
title: "We’re thinking about AI all wrong"
date: "2025-08-14"
author: "David Cox"
excerpt: "Presenting an opinionated view on generative AI."
tags: ["engineering", "reliability"]
coverImage: "/images/mellea-logo.svg"
---

So, I recognize that the title of this post may seem a bit provocative, and that’s on purpose. We’ll be presenting an opinionated view on generative AI, in the software engineering sense of the word “opinionated.” It would be difficult to overstate how much of our collective discourse and mental space is occupied by AI today. AI permeates almost every conversation—about business, about society, about geopolitics. Progress in AI technology has been moving at breakneck speed. However, building AI agents and solutions that reliably do what they need to is a lot harder than it should be, and I would argue that there is some real trouble brewing as the world begins to build AI agents to automate mission-critical work.

What’s the problem? In large part, I would argue that it has to do with anthropomorphism and how we think about “what” AI is. A pervasive mental model for AI (and especially agents) today is that are effectively human-like entities that we command to do our bidding. This framing runs deep: the dominant mode for interacting with LLMs today is multi-turn conversation (“chat”) even when they are operating autonomously in the background with no human in the loop. Our agent implementations provide the LLM with a persona (and in some cases a “backstory” of sorts), and we imagine a world where agents talk to one another and even form “teams.” To be clear, this is not any kind of indictment of the in-the-trenches folks building agents, as all of our current tooling forces us into this mode, and the whole field is so new, and the software ecosystem that has sprung around agents is understandably fragmented and evolving. We’ll discuss the pitfalls of anthropomorphism in AI in greater depth later, but suffice it say, there is a long history of people being led astray when they ascribe human qualities to technology. I believe that we will inevitably move beyond anthropomorphic approaches to AI, and that there will real advantages to doing so.

**In this Generative Computing blog series, we’ll explore the alternative framing that large language models are best thought of as computational engines, not so different from the computers that we’re used to today.** Like computers, they take instructions (albeit written in natural language), and they process various kinds of input data, and transform it into output data. This is not a new observation—and arguably part of what we’re doing here is to give name to a trend that is already emerging in the field. However, I would argue that we’ve only begun to scratch the surface of embracing generative AI as computing. I believe that taking this idea seriously will lead us to new programming models for interacting with LLMs, new tools and patterns for LLM usage, and even new ways of training LLMs. At the core of our philosophy is a belief that the full potential of generative AI will be realized by weaving AI together with traditional software in a seamless way. Generative computing describes a worldview where LLMs are an extension of computer science, not some alien entity set apart from it.[^1]

We’ll use the term “generative computing” as an umbrella over a wide range of topics. Computer science is a broad field of study, covering everything from computing hardware, to software architecture, to human-computer interaction. We believe that generative computing has the potential to be similarly broad, and our posts will reflect this diversity of topics.
Along the way, we will also introduce **Mellea**, an open-source python library where we are working to bring some of the key ideas of generative computing to life over time. If you’re eager to get your hands dirty right away, you can go straight to [**mellea.ai**](https://docs.mellea.ai) to get started. It’s early days, so expect some rough edges, but we’d love your feedback.

With our goals defined, let’s get started. In the next few posts, we’ll take a brief look at where the synthesis of generative AI and computing stands today, and we’ll lay out some of the challenges in current practice that led us to our current agenda. The purpose of these critiques is not to tear down or dismiss any of the amazing progress we’ve seen in AI. We’re optimistic about the potential and future of AI. Our goal is to identify problems so that we can fix them, and we’ll present one vision for what those fixes could look like, synthesizing some of our own ideas with a rich body of work from the field at large.

> **Up next:**
>
> 1. [**Outside-In and Inside-Out**: Imperative, Inductive, and Generative Computing](https://mellea.ai/blogs/generative-computing/)
> 2. **Unreliably Amazing**: Dealing with Unpredictability as a first-class principle in generative computing
> 3. **The problem with prompting**: Bringing composability and portability to generative AI
> 4. **Everything is data. Everything is also instructions**: examining the curious implicit execution and memory model of LLMs.

[^1]: Generative computing also places generative AI in the domain of “tools,” along with the rest of software, which I personally find more realistic, more obviously practical, and frankly less gross than an implicit narrative where the goal is to build human (or super-human) simulacra to replace the organic variety.
