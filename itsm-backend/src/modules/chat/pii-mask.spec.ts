import { maskPii } from "./pii-mask";

describe("maskPii", () => {
  it("masks emails, phones, PAN, Aadhaar-style and card numbers", () => {
    expect(maskPii("mail me at asha.k@meridian.com")).toBe("mail me at [email]");
    expect(maskPii("call +91 98765 43210 now")).toContain("[phone]");
    expect(maskPii("PAN ABCDE1234F")).toBe("PAN [PAN]");
    expect(maskPii("id 1234 5678 9012")).toBe("id [ID number]");
    expect(maskPii("card 4111 1111 1111 1111")).toContain("[card number]");
  });
  it("leaves ordinary text and short numbers alone", () => {
    expect(maskPii("My VPN is down since 9 am, ticket INC0000123")).toBe("My VPN is down since 9 am, ticket INC0000123");
  });
});
