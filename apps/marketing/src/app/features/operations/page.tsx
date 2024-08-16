import { WobbleCard } from "~/app/WobbleCard";
import {
  Heading,
  HeadingBadge,
  HeadingDescription,
  Separator,
} from "../Content";
import {
  Section,
  SectionContent,
  SectionContentBody,
  SectionContentHeading,
  SectionHeading,
} from "../Section";

export default function FeaturesOperationsPage() {
  return (
    <div>
      <HeadingBadge className="from-purple-500 to-violet-300">
        Operations
      </HeadingBadge>

      <Heading>Deliver Software 10x faster</Heading>

      <HeadingDescription>
        Ctrlplane empowers your team to break down barriers and accelerate your
        release process. Our intuitive platform simplifies complex deployments,
        automates your jobs, and provides the tools you need to ship code with
        confidence. No need to reinvent the wheel – Ctrlplane's built-in best
        practices scale seamlessly with your growing operations.
      </HeadingDescription>

      <Separator />
      <Section>
        <SectionHeading>Streamline Your Delivery</SectionHeading>
        <SectionContent>
          <div>
            <SectionContentHeading>
              Precise Release Management
            </SectionContentHeading>
            <SectionContentBody>
              Control exactly how and when your software is released.
            </SectionContentBody>
          </div>
          <div>
            <SectionContentHeading>
              Strategic Deployment Rollouts
            </SectionContentHeading>
            <SectionContentBody>
              Orchestrate deployments with granular rollouts, version
              validation, and robust scheduling options.
            </SectionContentBody>

            <WobbleCard containerClassName="my-4 bg-purple-900">
              <div>
                <h2 className="font-semibold text-white">
                  Environment Policies
                </h2>
                <p className="mt-4 text-neutral-200">
                  Create policies to make sure you are deploying the right
                  thing.
                </p>
              </div>
              {/* <Image
                src="/linear.webp"
                width={500}
                height={500}
                alt="linear demo image"
                className="absolute -bottom-10 -right-10 rounded-2xl object-contain md:-right-[40%] lg:-right-[20%]"
              /> */}
            </WobbleCard>
          </div>
          <div>
            <SectionContentHeading>
              Transparent Deployment History
            </SectionContentHeading>
            <SectionContentBody>
              Gain full visibility into every deployment, including who
              initiated it, how, and why.
            </SectionContentBody>
          </div>
          <div>
            <SectionContentHeading>
              Unify Your Existing Pipelines
            </SectionContentHeading>
            <SectionContentBody>
              Ctrlplane connects seamlessly with your existing CI/CD tools
              (GitHub, GitLab, Jenkins, etc.), orchestrating them all through a
              centralized interface. This accelerates your delivery process,
              eliminates silos, and gives you a unified view of your entire
              software lifecycle.
            </SectionContentBody>
          </div>
        </SectionContent>
      </Section>
      <Separator />
      <Section>
        <SectionHeading>Simplify Maintenance</SectionHeading>
        <SectionContent>
          <div>
            <SectionContentHeading>
              Instant Infrastructure Access
            </SectionContentHeading>
            <SectionContentBody>
              Instantly access your infrastructure with Ctrlplane's integrated
              web shell for on-the-fly debugging – no matter where you are.
            </SectionContentBody>
          </div>
          <div>
            <SectionContentHeading>Powerful Runbooks</SectionContentHeading>
            <SectionContentBody>
              Automate routine operations and incident response with
              customizable, event-driven or scheduled runbooks.
            </SectionContentBody>
          </div>
        </SectionContent>
      </Section>
    </div>
  );
}
