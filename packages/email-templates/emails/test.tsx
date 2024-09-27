import { Button, Hr, Html, Text } from "@react-email/components";

const TextEmail: React.FC = () => {
  return (
    <Html lang="en">
      <Text>Some title</Text>
      <Hr />
      <Button href="https://example.com">Click me</Button>
    </Html>
  );
};

export default TextEmail;
