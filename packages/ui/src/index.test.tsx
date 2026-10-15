import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { VERSION } from "./index.js";

describe("@funstack/ui test setup", () => {
  it("exports a VERSION placeholder", () => {
    expect(VERSION).toBe("0.0.0");
  });

  it("renders a React element in jsdom", () => {
    render(<p data-testid="greeting">Hello, FUNSTACK UI {VERSION}</p>);

    expect(screen.getByTestId("greeting")).toHaveTextContent("Hello, FUNSTACK UI 0.0.0");
  });
});
