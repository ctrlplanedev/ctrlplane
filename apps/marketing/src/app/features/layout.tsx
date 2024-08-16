import {
  TbBook,
  TbFingerprint,
  TbLock,
  TbLogs,
  TbRocket,
  TbShip,
  TbTarget,
  TbTerminal,
} from "react-icons/tb";

const Sidebar: React.FC<{ children?: React.ReactNode }> = ({ children }) => (
  <div>
    <div className="sticky left-0 top-24 w-[250px] shrink-0 space-y-10">
      {children}
    </div>
  </div>
);

const SidebarSection: React.FC<{ children?: React.ReactNode }> = ({
  children,
}) => <div className="space-y-2">{children}</div>;

const SidebarHeading: React.FC<{ children?: React.ReactNode }> = ({
  children,
}) => <div className="font-semibold">{children}</div>;

const SidebarItem: React.FC<{ children?: React.ReactNode }> = ({
  children,
}) => (
  <div className="flex items-center gap-2 text-neutral-300">{children}</div>
);

export default function FeatureLayout({
  children,
}: {
  children?: React.ReactNode;
}) {
  return (
    <div className="container max-w-6xl py-36">
      <div className="flex gap-10">
        <Sidebar>
          <SidebarSection>
            <SidebarHeading>Operations</SidebarHeading>
            <SidebarItem>
              <div className="to-bg-neutral-900 rounded-sm border bg-gradient-to-tl from-neutral-800/50 p-1 text-lg text-purple-400 drop-shadow-lg">
                <TbShip />
              </div>
              Deployments
            </SidebarItem>
            <SidebarItem>
              <div className="to-bg-neutral-900 rounded-sm border bg-gradient-to-tl from-neutral-800/50 p-1 text-lg text-purple-400 drop-shadow-lg">
                <TbTarget />
              </div>
              Targets
            </SidebarItem>
            <SidebarItem>
              <div className="to-bg-neutral-900 rounded-sm border bg-gradient-to-tl from-neutral-800/50 p-1 text-lg text-purple-400 drop-shadow-lg">
                <TbBook />
              </div>
              Runbooks
            </SidebarItem>
            <SidebarItem>
              <div className="to-bg-neutral-900 rounded-sm border bg-gradient-to-tl from-neutral-800/50 p-1 text-lg text-purple-400 drop-shadow-lg">
                <TbRocket />
              </div>
              CI/CD Integrations
            </SidebarItem>
          </SidebarSection>

          <SidebarSection>
            <SidebarHeading>Security</SidebarHeading>
            <SidebarItem>
              <div className="to-bg-neutral-900 rounded-sm border bg-gradient-to-tl from-neutral-800/50 p-1 text-lg text-green-400 drop-shadow-lg">
                <TbLock />
              </div>
              Safe and secure
            </SidebarItem>
            <SidebarItem>
              <div className="to-bg-neutral-900 rounded-sm border bg-gradient-to-tl from-neutral-800/50 p-1 text-lg text-green-400 drop-shadow-lg">
                <TbLogs />
              </div>
              Audit Logs
            </SidebarItem>
            <SidebarItem>
              <div className="to-bg-neutral-900 rounded-sm border bg-gradient-to-tl from-neutral-800/50 p-1 text-lg text-green-400 drop-shadow-lg">
                <TbTerminal />
              </div>
              Remote Shell
            </SidebarItem>
            <SidebarItem>
              <div className="to-bg-neutral-900 rounded-sm border bg-gradient-to-tl from-neutral-800/50 p-1 text-lg text-green-400 drop-shadow-lg">
                <TbFingerprint />
              </div>
              Identity Management
            </SidebarItem>
          </SidebarSection>
        </Sidebar>
        {children}
      </div>
    </div>
  );
}
