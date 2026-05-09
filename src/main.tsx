import { StartClient } from "@tanstack/react-start";
import { createRouter } from "./router";
import { isMockMode } from "./mocks/data";

if (isMockMode()) {
  const { worker } = await import("./mocks/browser");
  await worker.start({ onUnhandledRequest: "warn" });
}

const router = createRouter();

export default function App() {
  return <StartClient router={router} />;
}
