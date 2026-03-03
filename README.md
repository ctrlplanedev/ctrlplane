<p align="center">
  <a href="https://ctrlplane.dev">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://ctrlplane.dev/logo-white.png">
      <source media="(prefers-color-scheme: light)" srcset="https://ctrlplane.dev/logo-black.png">
      <img src="https://ctrlplane.dev/logo-black.png" alt="Ctrlplane" width="300">
    </picture>
  </a>
</p>

<p align="center">
  <a aria-label="Join the community on GitHub" href="https://github.com/ctrlplanedev/ctrlplane/discussions"><img alt="" src="https://img.shields.io/badge/Join_the_community-blueviolet?style=for-the-badge"></a>
  <a aria-label="Commit activity" href="https://github.com/ctrlplanedev/ctrlplane/activity"><img alt="" src="https://img.shields.io/github/commit-activity/m/ctrlplanedev/ctrlplane/main?style=for-the-badge"></a>
</p>

<p align="center">
  <a href="https://ctrlplane.dev"><b>Website</b></a> •
  <a href="https://github.com/ctrlplanedev/ctrlplane/releases"><b>Releases</b></a> •
  <a href="https://docs.ctrlplane.dev"><b>Documentation</b></a>
</p>

---

## What is Ctrlplane?

**Ctrlplane is the orchestration layer between your CI/CD pipelines and your infrastructure.**

Your CI builds code. Your clusters run it. Ctrlplane decides _when_ releases are ready, _where_ they should deploy, and _what gates_ they must pass—handling environment promotion, verification, approvals, and rollbacks automatically.

```
Your CI/CD    ──►    Ctrlplane    ──►    Your Infrastructure
 (builds)          (orchestrates)           (deploys)
```

## Why Ctrlplane?

| Problem                             | How Ctrlplane Helps                                           |
| ----------------------------------- | ------------------------------------------------------------- |
| Manual environment promotion        | Auto-promote staging → prod when verification passes          |
| "Did the deploy actually work?"     | Automated verification via Datadog, Prometheus, HTTP checks   |
| Deploying to 50 clusters is painful | One deployment definition, Ctrlplane handles the fan-out      |
| No visibility into what's running   | Unified inventory: which version, which cluster, which region |
| Inconsistent deployment policies    | Centralized policy engine with flexible selectors             |

## :rocket: Key Features

- **Gradual Rollouts** — Deploy to targets sequentially with configurable intervals and verification between each
- **Policy Gates** — Require approvals, enforce environment sequencing, set deployment windows
- **Automated Verification** — Integrate with Datadog, Prometheus, or any HTTP endpoint
- **Auto-Rollback** — Automatically revert when verification fails
- **Infrastructure Inventory** — Unified view of resources across Kubernetes, cloud providers, and custom infra
- **Pluggable Execution** — Works with ArgoCD, Kubernetes Jobs, GitHub Actions, Terraform Cloud, or custom agents

## Who Is It For?

- **Platform teams** building internal developer platforms
- **DevOps/SRE** enforcing deployment policies at scale
- **Engineering orgs** with 10+ services across multiple environments
- **Multi-region deployments** needing coordinated rollouts

## :zap: Quick Start

The fastest way to get started is with [Ctrlplane Cloud](https://app.ctrlplane.dev).

For self-hosted options, see our [installation guide](https://docs.ctrlplane.dev/installation).

| Method     | Link                                                                                                                                                                                           |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Docker     | [![Docker](https://img.shields.io/badge/docker-%230db7ed.svg?style=for-the-badge&logo=docker&logoColor=white)](https://docs.ctrlplane.dev/installation#docker-compose-development-%26-testing) |
| Kubernetes | [![Kubernetes](https://img.shields.io/badge/kubernetes-%23326ce5.svg?style=for-the-badge&logo=kubernetes&logoColor=white)](https://docs.ctrlplane.dev/installation#kubernetes-production)      |

## How It Works

1. **CI creates a version** — Your build pipeline registers a new version with Ctrlplane
2. **Ctrlplane plans releases** — Based on environments and selectors, it creates release targets
3. **Policies are evaluated** — Approval gates, environment progression, gradual rollout rules
4. **Jobs execute** — Ctrlplane dispatches to your job agent (ArgoCD, K8s Jobs, GitHub Actions)
5. **Verification runs** — Metrics are checked; pass → promote, fail → rollback

## 📚 Documentation

- [Quickstart](https://docs.ctrlplane.dev/quickstart) — Deploy your first service in 15 minutes
- [Core Concepts](https://docs.ctrlplane.dev/concepts/introduction) — Systems, deployments, environments, resources
- [Policies](https://docs.ctrlplane.dev/policies/overview) — Approvals, verification, gradual rollouts
- [Integrations](https://docs.ctrlplane.dev/integrations/cicd) — GitHub Actions, ArgoCD, Kubernetes

## 🛠️ Contributing

> Development system must have Docker engine installed and running.

```bash
git clone https://github.com/ctrlplanedev/ctrlplane.git
cd ctrlplane
cp .env.example .env
docker compose -f docker-compose.dev.yaml up -d
cd packages/db && pnpm migrate && cd ../..
pnpm dev
```

## 🏢 Contributing at W&B / CoreWeave — FAQ

**Q: What license was chosen for ctrlplane, and why?**

A: The GNU Affero General Public License (AGPL-3.0). It is designed specifically to ensure that modified source code becomes available to the community. It requires the operator of a network server to provide the source code of the modified version running there to the users of that server. Therefore, public use of a modified version, on a publicly accessible server, gives the public access to the source code of the modified version.

**Q: How do the W&B fork and public repo differ?**

A: Not meaningfully. At the moment, most activity happens on the public repo.

**Q: Does contributing to this open source project create a conflict of interest?**

A: If contributing to this project during your duties as an employee of W&B, you are implicitly agreeing to following terms of the legal agreement signed Oct 29 2024 that states:

> "I am not engaged in, and shall not engage in, any activities that may be perceived as conflicting with the best interest of W&B; If a new or changed conflict should arise, I am required to notify my manager; I understand that W&B employees who knowingly fail to disclose potential or actual conflicts of interest could be subject to discipline, including without limitation dismissal; I understand that W&B may decide it is in the best interest of W&B for me to distance myself with the conflicting interest or the perception of a conflict of interest, which could mean adjusting job duties or responsibilities to eliminate the potential for a conflict of interest. I will comply with all such instructions from W&B."

**Q: What does the conflict of interest clause mean in plain English?**

A: If you contributing to ctrlplane to solve problems that benefit your team, the company, and/or customers, you likely do not have a conflict of interest. If you are contributing changes during company time using company assets for personal or outside buiness gain, you may have a conflict of interest. When in doubt, [file an intake form before contributing](https://coreweave.atlassian.net/wiki/x/UADcFg). 

The intention of making ctrplane opensource under AGPL-3.0 is to "specifically designed to ensure cooperation with the community." The conflict of interest standard is applicable to your overall employment with CoreWeave, not ctrlplane specifically. Please contribute!  

**Q: What rights does CoreWeave/W&B have to the code I contribute?**

A: Per the legal agreement signed Oct 29 2024, W&B is granted:

> "a royalty-free, fully-paid up, perpetual, irrevocable, worldwide, sublicensable (through multiple tiers), transferable license to use, copy, modify, distribute, create derivative works of and otherwise exploit the Software for any purpose, without any obligation to me of any kind, which for clarity includes without limitation the right to sell products or services incorporating or otherwise using the Software."

**Q: What happens to the code I contribute?**

A: Code contributed during working hours on W&B assets is governed by the conflict of interest documents and subject to the W&B rights stated above. Code contributed outside of working hours on your own assets, that does not pose a conflict of interest, is subject to the terms of the AGPL-3.0 license.

---

## :heart: Community

- [GitHub Discussions](https://github.com/ctrlplanedev/ctrlplane/discussions)
- [Discord](https://ctrlplane.dev/discord)

Ask questions, report bugs, join discussions, voice ideas, make feature requests, or share your projects.

![Alt](https://repobeats.axiom.co/api/embed/354918f3c89424e9615c77d36b62aaeb67d9b7fb.svg "Repobeats analytics image")

## ⛓️ Security

If you believe you have found a security vulnerability, we encourage you to responsibly disclose this and not open a public issue.

Email `security@ctrlplane.dev` to disclose any security vulnerabilities.

---

### We couldn't have done this without you

<a href="https://github.com/ctrlplanedev/ctrlplane/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=ctrlplanedev/ctrlplane" />
</a>
