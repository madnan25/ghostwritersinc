import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UploadForm } from "./upload-form";

describe("UploadForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uploads a file and notifies on success", async () => {
    const user = userEvent.setup();
    const onUploadComplete = vi.fn();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "upload-1" }),
    });

    vi.stubGlobal("fetch", fetchMock);

    render(<UploadForm onUploadComplete={onUploadComplete} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["hello"], "chat.txt", { type: "text/plain" });
    await user.upload(input, file);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/research/upload",
        expect.objectContaining({ method: "POST" })
      );
    });
    expect(onUploadComplete).toHaveBeenCalled();
  });

  it("shows an error when the upload fails", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Upload failed" }),
    });

    vi.stubGlobal("fetch", fetchMock);

    render(<UploadForm onUploadComplete={vi.fn()} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["hello"], "chat.txt", { type: "text/plain" });
    await user.upload(input, file);

    await screen.findByText("Upload failed");
  });
});
