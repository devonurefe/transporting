/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeAll } from "vitest";
import { resizeImage } from "../utils/image";

describe("resizeImage", () => {
  beforeAll(() => {
    // Mock FileReader API
    class MockFileReader {
      onload: any = null;
      onerror: any = null;
      readAsDataURL(file: any) {
        setTimeout(() => {
          if (this.onload) {
            this.onload({ target: { result: "data:image/png;base64,mockbase64" } });
          }
        }, 10);
      }
    }
    vi.stubGlobal("FileReader", MockFileReader);

    // Mock Image API
    class MockImage {
      onload: any = null;
      onerror: any = null;
      _src: string = "";
      width = 2000;
      height = 1000;

      set src(value: string) {
        this._src = value;
        setTimeout(() => {
          if (this.onload) {
            this.onload();
          }
        }, 10);
      }
      get src() {
        return this._src;
      }
    }
    vi.stubGlobal("Image", MockImage);

    // Mock document.createElement("canvas")
    const mockContext = {
      drawImage: vi.fn(),
    };
    const mockCanvas = {
      width: 0,
      height: 0,
      getContext: vi.fn().mockReturnValue(mockContext),
      toDataURL: vi.fn().mockReturnValue("data:image/jpeg;base64,compressedmock"),
    };
    vi.stubGlobal("document", {
      createElement: vi.fn().mockImplementation((tagName: string) => {
        if (tagName === "canvas") {
          return mockCanvas;
        }
        return {};
      }),
    });
  });

  it("should compress and resize a large image using mock canvas APIs", async () => {
    const file = new File(["dummy content"], "test.png", { type: "image/png" });
    const result = await resizeImage(file, 1200, 1200);

    expect(result).toBe("data:image/jpeg;base64,compressedmock");
    expect(global.document.createElement).toHaveBeenCalledWith("canvas");
  });
});
