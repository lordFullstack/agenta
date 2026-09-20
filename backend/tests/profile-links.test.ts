// tests/profile-links.test.ts
import {
  InvalidProfileError,
  normalizeAddress,
  normalizeDescription,
  normalizeFacebook,
  normalizeInstagram,
} from "../src/profile-links";

describe("normalizeAddress", () => {
  it("recorta y colapsa espacios", () => {
    expect(normalizeAddress("  Cra 8  #12-45,   Centro, Montelíbano ")).toBe("Cra 8 #12-45, Centro, Montelíbano");
  });
  it("null, undefined y vacío significan 'borrarla'", () => {
    expect(normalizeAddress(null)).toBeNull();
    expect(normalizeAddress(undefined)).toBeNull();
    expect(normalizeAddress("   ")).toBeNull();
  });
  it("rechaza lo que no es texto o es demasiado largo", () => {
    expect(() => normalizeAddress(123)).toThrow(InvalidProfileError);
    expect(() => normalizeAddress("x".repeat(201))).toThrow(/muy larga/);
  });
});

describe("normalizeDescription", () => {
  it("conserva los saltos de línea y recorta los bordes", () => {
    expect(normalizeDescription("  Hola\r\nSomos El Socio  ")).toBe("Hola\nSomos El Socio");
  });
  it("'' es válido (la borra) pero más de 500 caracteres no", () => {
    expect(normalizeDescription("")).toBe("");
    expect(() => normalizeDescription("a".repeat(501))).toThrow(InvalidProfileError);
    expect(() => normalizeDescription(null)).toThrow(InvalidProfileError);
  });
});

describe("normalizeInstagram", () => {
  it.each([
    ["@barberia_elsocio", "https://www.instagram.com/barberia_elsocio"],
    ["barberia.elsocio", "https://www.instagram.com/barberia.elsocio"],
    ["https://instagram.com/barberia_elsocio/", "https://www.instagram.com/barberia_elsocio"],
    ["instagram.com/barberia_elsocio?igshid=abc", "https://www.instagram.com/barberia_elsocio"],
    ["https://www.instagram.com/barberia_elsocio/?hl=es", "https://www.instagram.com/barberia_elsocio"],
  ])("%s → %s", (input, expected) => {
    expect(normalizeInstagram(input)).toBe(expected);
  });

  it("vacío o null lo borra", () => {
    expect(normalizeInstagram("")).toBeNull();
    expect(normalizeInstagram(null)).toBeNull();
  });

  it.each([
    "javascript:alert(1)",
    "https://evil.com/instagram.com/x",
    "https://instagram.com.evil.com/x",
    "https://instagram.com/p/ABC123",
    "https://instagram.com/",
    "instagram.com",
    "dos palabras",
    "a".repeat(31),
  ])("rechaza %s", (input) => {
    expect(() => normalizeInstagram(input)).toThrow(InvalidProfileError);
  });
});

describe("normalizeFacebook", () => {
  it.each([
    ["barberiaelsocio", "https://www.facebook.com/barberiaelsocio"],
    ["https://www.facebook.com/barberiaelsocio/", "https://www.facebook.com/barberiaelsocio"],
    ["facebook.com/barberia.elsocio", "https://www.facebook.com/barberia.elsocio"],
    ["https://m.facebook.com/barberiaelsocio", "https://www.facebook.com/barberiaelsocio"],
    ["https://www.facebook.com/profile.php?id=100012345678901&ref=x", "https://www.facebook.com/profile.php?id=100012345678901"],
    ["https://www.facebook.com/pages/El-Socio/123456", "https://www.facebook.com/pages/El-Socio/123456"],
  ])("%s → %s", (input, expected) => {
    expect(normalizeFacebook(input)).toBe(expected);
  });

  it("vacío o null lo borra", () => {
    expect(normalizeFacebook(" ")).toBeNull();
    expect(normalizeFacebook(null)).toBeNull();
  });

  it.each([
    "javascript:alert(1)",
    "https://evil.com/facebook.com/x",
    "https://facebook.com.evil.com/x",
    "https://www.facebook.com/",
    "https://www.facebook.com/profile.php?id=abc",
    "abc",
  ])("rechaza %s", (input) => {
    expect(() => normalizeFacebook(input)).toThrow(InvalidProfileError);
  });
});
