import "@testing-library/jest-dom";

// Mock Next.js router
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
  }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

// Mock next-auth
jest.mock("next-auth/react", () => ({
  useSession: () => ({
    data: null,
    status: "unauthenticated",
  }),
  getServerSession: jest.fn(),
}));

// Mock Framer Motion
jest.mock("framer-motion", () => ({
  motion: {
    div: "div",
    section: "section",
    article: "article",
    a: "a",
    span: "span",
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
  useInView: () => true,
  useScroll: () => ({ scrollYProgress: 0 }),
  useTransform: () => 0,
  useSpring: () => 0,
  useMotionValue: () => 0,
}));

// Suppress console errors in tests
const originalError = console.error;
beforeAll(() => {
  console.error = (...args: any[]) => {
    if (
      typeof args[0] === "string" &&
      (args[0].includes("Warning: ReactDOM.render") ||
        args[0].includes("Not implemented: HTMLFormElement.prototype.submit"))
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
});
