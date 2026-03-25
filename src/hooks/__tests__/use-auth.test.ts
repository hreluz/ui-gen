import { test, expect, vi, beforeEach, describe } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAuth } from "@/hooks/use-auth";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/actions", () => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
}));

vi.mock("@/lib/anon-work-tracker", () => ({
  getAnonWorkData: vi.fn(),
  clearAnonWork: vi.fn(),
}));

vi.mock("@/actions/get-projects", () => ({
  getProjects: vi.fn(),
}));

vi.mock("@/actions/create-project", () => ({
  createProject: vi.fn(),
}));

import { signIn as signInAction, signUp as signUpAction } from "@/actions";
import { getAnonWorkData, clearAnonWork } from "@/lib/anon-work-tracker";
import { getProjects } from "@/actions/get-projects";
import { createProject } from "@/actions/create-project";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getAnonWorkData).mockReturnValue(null);
  vi.mocked(getProjects).mockResolvedValue([]);
  vi.mocked(createProject).mockResolvedValue({ id: "new-project-id" } as any);
});

describe("useAuth", () => {
  test("returns signIn, signUp, and isLoading=false initially", () => {
    const { result } = renderHook(() => useAuth());

    expect(result.current.signIn).toBeDefined();
    expect(result.current.signUp).toBeDefined();
    expect(result.current.isLoading).toBe(false);
  });

  describe("signIn", () => {
    test("returns the result from the action", async () => {
      vi.mocked(signInAction).mockResolvedValue({ success: true });
      vi.mocked(getProjects).mockResolvedValue([{ id: "proj-1" } as any]);

      const { result } = renderHook(() => useAuth());

      let returnValue: any;
      await act(async () => {
        returnValue = await result.current.signIn("user@example.com", "password");
      });

      expect(returnValue).toEqual({ success: true });
    });

    test("sets isLoading to true while in-flight and false after", async () => {
      let resolveSignIn!: (v: any) => void;
      vi.mocked(signInAction).mockReturnValue(new Promise((res) => { resolveSignIn = res; }) as any);

      const { result } = renderHook(() => useAuth());

      act(() => {
        result.current.signIn("user@example.com", "password");
      });

      expect(result.current.isLoading).toBe(true);

      await act(async () => {
        resolveSignIn({ success: false, error: "Invalid credentials" });
      });

      expect(result.current.isLoading).toBe(false);
    });

    test("redirects to existing project when sign-in succeeds and projects exist", async () => {
      vi.mocked(signInAction).mockResolvedValue({ success: true });
      vi.mocked(getProjects).mockResolvedValue([{ id: "proj-1" }, { id: "proj-2" }] as any);

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("user@example.com", "password");
      });

      expect(mockPush).toHaveBeenCalledWith("/proj-1");
      expect(createProject).not.toHaveBeenCalled();
    });

    test("creates a new project and redirects when sign-in succeeds and no projects exist", async () => {
      vi.mocked(signInAction).mockResolvedValue({ success: true });
      vi.mocked(getProjects).mockResolvedValue([]);
      vi.mocked(createProject).mockResolvedValue({ id: "brand-new" } as any);

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("user@example.com", "password");
      });

      expect(createProject).toHaveBeenCalledWith(
        expect.objectContaining({ messages: [], data: {} })
      );
      expect(mockPush).toHaveBeenCalledWith("/brand-new");
    });

    test("migrates anonymous work to a new project on successful sign-in", async () => {
      const anonWork = {
        messages: [{ role: "user", content: "hello" }],
        fileSystemData: { "/": { type: "directory" } },
      };
      vi.mocked(signInAction).mockResolvedValue({ success: true });
      vi.mocked(getAnonWorkData).mockReturnValue(anonWork);
      vi.mocked(createProject).mockResolvedValue({ id: "anon-proj" } as any);

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("user@example.com", "password");
      });

      expect(createProject).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: anonWork.messages,
          data: anonWork.fileSystemData,
        })
      );
      expect(clearAnonWork).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/anon-proj");
      expect(getProjects).not.toHaveBeenCalled();
    });

    test("does not redirect or create project when sign-in fails", async () => {
      vi.mocked(signInAction).mockResolvedValue({ success: false, error: "Invalid credentials" });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("user@example.com", "wrong-password");
      });

      expect(mockPush).not.toHaveBeenCalled();
      expect(createProject).not.toHaveBeenCalled();
      expect(clearAnonWork).not.toHaveBeenCalled();
    });

    test("does not migrate anon work with empty messages on successful sign-in", async () => {
      vi.mocked(signInAction).mockResolvedValue({ success: true });
      vi.mocked(getAnonWorkData).mockReturnValue({ messages: [], fileSystemData: {} });
      vi.mocked(getProjects).mockResolvedValue([{ id: "existing" }] as any);

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("user@example.com", "password");
      });

      expect(clearAnonWork).not.toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/existing");
    });

    test("resets isLoading to false even when action throws", async () => {
      vi.mocked(signInAction).mockRejectedValue(new Error("Network error"));

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("user@example.com", "password").catch(() => {});
      });

      expect(result.current.isLoading).toBe(false);
    });
  });

  describe("signUp", () => {
    test("returns the result from the action", async () => {
      vi.mocked(signUpAction).mockResolvedValue({ success: true });
      vi.mocked(getProjects).mockResolvedValue([{ id: "proj-1" } as any]);

      const { result } = renderHook(() => useAuth());

      let returnValue: any;
      await act(async () => {
        returnValue = await result.current.signUp("new@example.com", "password123");
      });

      expect(returnValue).toEqual({ success: true });
    });

    test("sets isLoading to true while in-flight and false after", async () => {
      let resolveSignUp!: (v: any) => void;
      vi.mocked(signUpAction).mockReturnValue(new Promise((res) => { resolveSignUp = res; }) as any);

      const { result } = renderHook(() => useAuth());

      act(() => {
        result.current.signUp("new@example.com", "password123");
      });

      expect(result.current.isLoading).toBe(true);

      await act(async () => {
        resolveSignUp({ success: false, error: "Email already registered" });
      });

      expect(result.current.isLoading).toBe(false);
    });

    test("redirects to existing project when sign-up succeeds and projects exist", async () => {
      vi.mocked(signUpAction).mockResolvedValue({ success: true });
      vi.mocked(getProjects).mockResolvedValue([{ id: "proj-1" }] as any);

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signUp("new@example.com", "password123");
      });

      expect(mockPush).toHaveBeenCalledWith("/proj-1");
    });

    test("creates a new project and redirects when sign-up succeeds and no projects exist", async () => {
      vi.mocked(signUpAction).mockResolvedValue({ success: true });
      vi.mocked(createProject).mockResolvedValue({ id: "fresh-project" } as any);

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signUp("new@example.com", "password123");
      });

      expect(createProject).toHaveBeenCalledWith(
        expect.objectContaining({ messages: [], data: {} })
      );
      expect(mockPush).toHaveBeenCalledWith("/fresh-project");
    });

    test("migrates anonymous work to a new project on successful sign-up", async () => {
      const anonWork = {
        messages: [{ role: "user", content: "build me a button" }],
        fileSystemData: { "/": { type: "directory" }, "/App.tsx": { type: "file" } },
      };
      vi.mocked(signUpAction).mockResolvedValue({ success: true });
      vi.mocked(getAnonWorkData).mockReturnValue(anonWork);
      vi.mocked(createProject).mockResolvedValue({ id: "migrated-proj" } as any);

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signUp("new@example.com", "password123");
      });

      expect(createProject).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: anonWork.messages,
          data: anonWork.fileSystemData,
        })
      );
      expect(clearAnonWork).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/migrated-proj");
    });

    test("does not redirect or create project when sign-up fails", async () => {
      vi.mocked(signUpAction).mockResolvedValue({ success: false, error: "Email already registered" });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signUp("existing@example.com", "password123");
      });

      expect(mockPush).not.toHaveBeenCalled();
      expect(createProject).not.toHaveBeenCalled();
    });

    test("resets isLoading to false even when action throws", async () => {
      vi.mocked(signUpAction).mockRejectedValue(new Error("Network error"));

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signUp("new@example.com", "password123").catch(() => {});
      });

      expect(result.current.isLoading).toBe(false);
    });
  });
});
