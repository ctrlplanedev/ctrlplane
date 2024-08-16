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

export default function FeaturesSecurityPage() {
  return (
    <div>
      <HeadingBadge className="from-green-500 to-green-300">
        Security
      </HeadingBadge>

      <Heading>Safe, secure, and private</Heading>

      <HeadingDescription>
        Enterprise-grade security, state-of-the-art encryption, advanced
        identity management, admin controls, and much more. Everything in
        Ctrlplane is designed to keep your data safe and secure. Because your
        business is nobody else’s business.
      </HeadingDescription>

      <Separator />
      <Section>
        <SectionHeading>Safe and Secure</SectionHeading>
        <SectionContent>
          <div>
            <SectionContentHeading>
              Reliable and secure infrastructure partners
            </SectionContentHeading>
            <SectionContentBody>
              Ctrlplane uses Google Cloud Platform (GCP) and hosts services
              within its own secure cloud environment.
            </SectionContentBody>
          </div>

          <div>
            <SectionContentHeading>Environment Approval</SectionContentHeading>
            <SectionContentBody>
              Control which environments can be deployed to.
            </SectionContentBody>
          </div>
          <div>
            <SectionContentHeading>Audit Logs</SectionContentHeading>
            <SectionContentBody>
              Keep track of who, how, and why, a deployment was triggered.
            </SectionContentBody>
          </div>
        </SectionContent>
      </Section>
      <Separator />
      <Section>
        <SectionHeading>Privacy</SectionHeading>
        <SectionContent>
          <div>
            <SectionContentHeading>
              Reliable and secure infrastructure partners
            </SectionContentHeading>
            <SectionContentBody>
              Ctrlplane forces HTTPS on all connections and encrypts data
              in-transit with TLS 1.2. All data at-rest is secured using AES
              256-bit encryption.
            </SectionContentBody>
          </div>
          <div>
            <SectionContentHeading>Private teams</SectionContentHeading>
            <SectionContentBody>
              Create private systems or deployments that should only be accessed
              by certain members.
            </SectionContentBody>
          </div>
        </SectionContent>
      </Section>
    </div>
  );
}
