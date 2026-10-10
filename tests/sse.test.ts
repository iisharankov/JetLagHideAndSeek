import { describe, expect, it } from "vitest";

import { parseSse } from "@/lib/game/api";

describe("parseSse", () => {
    it("reads an event's name and data", () => {
        expect(parseSse('event: state\ndata: {"a":1}')).toEqual({
            event: "state",
            data: '{"a":1}',
        });
    });

    it("joins several data lines, skips comments, defaults the event", () => {
        expect(parseSse(": keep-alive\nid: 7\ndata: one\ndata:two")).toEqual({
            event: "message",
            data: "one\ntwo",
        });
    });

    it("copes with Windows line ends and empty data", () => {
        expect(parseSse("event: ping\r\ndata: \r\n")).toEqual({
            event: "ping",
            data: "",
        });
    });
});
