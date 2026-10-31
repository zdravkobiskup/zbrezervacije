/// <reference types="bun" />
import { expect, test } from "bun:test";
import { matchingClients, parseManualClient, uniqueReturningClients } from "./returning-clients";

test("first letter suggests only clients whose names start with that letter", () => {
  const clients = [
    { name: "Ana Marić", phone: "0911234567", email: "ana@example.com" },
    { name: "Boris Ivić", phone: "", email: "boris@example.com" },
    { name: "Anita Novak", phone: "", email: "" },
  ];
  expect(matchingClients(clients, "a").map((client) => client.name)).toEqual(["Ana Marić", "Anita Novak"]);
  expect(matchingClients(clients, "")).toEqual([]);
});

test("manual booking restores all stored contact fields without appointment notes", () => {
  expect(parseManualClient("[RUČNA REZERVACIJA] Klijent: Ana Marić, Tel: 0911234567, Email: ana@example.com\nNapomena")).toEqual({
    name: "Ana Marić", phone: "0911234567", email: "ana@example.com",
  });
  expect(parseManualClient("Obična napomena")).toBeNull();
  expect(parseManualClient("[RUČNA REZERVACIJA] Klijent: Ana, Email: ana@example.com")).toEqual({
    name: "Ana", phone: "", email: "ana@example.com",
  });
});

test("repeated customers retain newest contacts and namesakes remain distinct", () => {
  const clients = uniqueReturningClients([
    { name: "Ana", phone: "0912222222", email: "ana@example.com" },
    { name: "Ana", phone: "0911111111", email: "ana@example.com" },
    { name: "Ana", phone: "0913333333", email: "another@example.com" },
  ]);
  expect(clients).toHaveLength(2);
  expect(clients[0].phone).toBe("0912222222");
  expect(clients[1].email).toBe("another@example.com");
});

test("Croatian letters match case-insensitively from the first character", () => {
  expect(matchingClients([{ name: "Željka", phone: "", email: "" }], "ž")).toHaveLength(1);
});