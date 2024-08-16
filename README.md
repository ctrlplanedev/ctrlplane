<p align="center">
  <a href="https://ctrlplane.dev">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://ctrlplane.dev/android-chrome-512x512.png">
      <img src="https://ctrlplane.dev/android-chrome-512x512.png" height="128">
    </picture>
    <h1 align="center">Ctrlplane</h1>
  </a>
</p>

<p align="center">
  <a aria-label="License" href="https://github.com/ctrl-plane/ctrlplane/blob/main/LICENSE"><img alt="" src="https://img.shields.io/badge/SSPL-blue?style=for-the-badge"></a>
  <a aria-label="Join the community on GitHub" href="https://github.com/ctrl-plane/ctrlplane/discussions"><img alt="" src="https://img.shields.io/badge/Join_the_community-blueviolet?style=for-the-badge"></a>
</p>

## Getting Started

Ctrlplane is a flexible and powerful deployment orchestration platform designed
to streamline and automate your software release process. It complements your
existing CI/CD tools by providing centralized management, automated triggers,
and seamless integrations.

## Documentation

Visit https://docs.ctrlplane.dev to view the full documentation.

## Community

The Ctrlplane community can be found on GitHub Discussions where you can ask
questions, voice ideas, and share your projects with other people.

Do note that our Code of Conduct applies to all Ctrlplane community channels.
Users are highly encouraged to read and adhere to them to avoid repercussions.

## Contributing

Contributions to Ctrlplane are welcome and highly appreciated. However, before
you jump right into it, we would like you to review our Contribution Guidelines
to make sure you have a smooth experience contributing to Ctrlplane.

## Authors

A list of the original co-authors of Ctrlplane that helped bring this amazing
tool to life!

- Justin Brooks ([@jsbroks](https://github.com/jsbroks))
- Aditya Choudhari ([@adityachoudhari26](https://github.com/adityachoudhari26))

## Development Mode

1.  Setup dependencies

```bash
# Install dependencies
pnpm i

# Configure environment variables
# There is an `.env.example` in the root directory you can use for reference
cp .env.example .env

# Push the schema to the database
pnpm db:push
```

2. Run `pnpm dev` at the project root folder.
