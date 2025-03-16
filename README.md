<p align="center">
  <a href="https://ctrlplane.dev">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://ctrlplane.dev/logo-white.png">
      <source media="(prefers-color-scheme: light)" srcset="https://ctrlplane.dev/logo-black.png">
      <img src="https://ctrlplane.dev/logo-black.png" height="60">
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

Meet [Ctrlplane](https://ctrlplane.dev), an open-source **deployment
orchestration** tool.

## :rocket: Features

- **Unified Control:** Centralize management of multi-stage deployment pipelines
  across diverse environments.
- **Flexible Resource Support:** Deploy to Kubernetes, cloud functions, VMs, or
  custom infrastructure from a single platform.
- **Advanced Workflow Orchestration:** Automate sophisticated deployment
  processes including testing, code analysis, security scans, and approval
  gates.
- **CI/CD Integration:** Seamlessly connects with Jenkins, GitLab CI, GitHub
  Actions, and other popular CI tools to trigger deployments.
- **Environment Management:** Efficiently handle transitions between dev, test,
  staging, and production environments.

## 💪 Trusted by

<p align="center">
  <a href="https://wandb.ai">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://github.com/ctrlplanedev/ctrlplane/blob/main/assets/trusted-by/wb-white.png?raw=true">
      <source media="(prefers-color-scheme: light)" srcset="https://github.com/ctrlplanedev/ctrlplane/blob/main/assets/trusted-by/wb-black.png?raw=true">
      <img src="https://github.com/ctrlplanedev/ctrlplane/blob/main/assets/trusted-by/wb-white.png?raw=true" height="100" alt="Weights & Biases">
    </picture>
  </a>
</p>

## :zap: Installation

The easiest way to get started with Ctrlplane is by creating a [Ctrlplane
Cloud](https://app.ctrlplane.dev) account.

If you would like to self-host Plane, please see our [deployment guide](https://docs.ctrlplane.dev/install/helm).

| Installation methods | Docs link                                                                                                                                                                             |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Docker               | [![Docker](https://img.shields.io/badge/docker-%230db7ed.svg?style=for-the-badge&logo=docker&logoColor=white)](https://docs.ctrlplane.dev/self-hosted/methods/docker-compose)         |
| Kubernetes           | [![Kubernetes](https://img.shields.io/badge/kubernetes-%23326ce5.svg?style=for-the-badge&logo=kubernetes&logoColor=white)](https://docs.ctrlplane.dev/self-hosted/methods/kubernetes) |

## 🛠️ Quick start for contributors

> Development system must have docker engine installed and running.

1. Clone the code locally using:
   ```
   git clone https://github.com/ctrlplanedev/ctrlplane.git
   ```
2. Switch to the code folder:
   ```
   cd ctrlplane
   ```
3. Create your feature or fix branch you plan to work on using:
   ```
   git checkout -b <feature-branch-name>
   ```
4. Open the code on VSCode or similar equivalent IDE.
5. Copy `.env.example` to `.env` files available in various folders.
6. Run the docker command to initiate services:
   ```
   docker compose -f docker-compose.dev.yaml up -d
   ```
7. `cd packages/db && pnpm migrate && cd ../..` to run the migrations.
8. Run `pnpm dev` to start the development server.

You are ready to make changes to the code. Do not forget to refresh the browser
(in case it does not auto-reload).

Thats it!

## 🤝 Design Partners Wanted!

**We're actively seeking design partners** to collaborate on shaping the future
of Ctrlplane. If your organization is looking to improve deployment workflows
and would like early access to new features while providing valuable feedback,
we'd love to hear from you!

- Get priority support and feature development
- Influence product roadmap decisions
- Receive white-glove onboarding assistance
- Join our exclusive design partner community

**Interested?** Email us at support@ctrlplane.dev to discuss how we can work
together.

## :heart: Community

The Ctrlplane community can be found on [GitHub
Discussions](https://github.com/ctrlplanedev/ctrlplane/discussions), and our [Discord
server](https://ctrlplane.dev/discord)

Ask questions, report bugs, join discussions, voice ideas, make feature
requests, or share your projects.

![Alt](https://repobeats.axiom.co/api/embed/354918f3c89424e9615c77d36b62aaeb67d9b7fb.svg "Repobeats analytics image")

## ⛓️ Security

If you believe you have found a security vulnerability in Plane, we encourage
you to responsibly disclose this and not open a public issue. We will
investigate all legitimate reports.

Email security@ctrlplane.dev to disclose any security vulnerabilities.

### We couldn't have done this without you.

<a href="https://github.com/ctrlplanedev/ctrlplane/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=ctrlplanedev/ctrlplane" />
</a>
