// Airports that count as "commercial" for airport questions: those with
// regular international passenger flights, within reach of Switzerland
// (about 300 km). Edit this list to change which airports count, then rebuild
// the reference data (deploy/README.md) and the app.
//
// Written from general knowledge, not checked against current timetables:
// please review. Codes are IATA codes as tagged in OpenStreetMap.

export const COMMERCIAL_AIRPORTS: Record<string, string> = {
    // Switzerland
    ZRH: "Zürich",
    GVA: "Geneva",
    BSL: "EuroAirport Basel-Mulhouse-Freiburg (France)",
    MLH: "EuroAirport Basel-Mulhouse-Freiburg (France)",
    EAP: "EuroAirport Basel-Mulhouse-Freiburg (France)",
    BRN: "Bern",
    ACH: "St. Gallen-Altenrhein",
    // Left out, add them if they have flights when you play:
    // LUG Lugano (no scheduled flights since 2020, as far as I know),
    // SIR Sion (occasional seasonal flights only), SMV Engadin, BXO Buochs,
    // EML Emmen and VIP Payerne (airfields and military bases).

    // Germany
    FDH: "Friedrichshafen",
    FMM: "Memmingen",
    STR: "Stuttgart",
    FKB: "Karlsruhe/Baden-Baden",
    MUC: "Munich",
    NUE: "Nuremberg",
    FRA: "Frankfurt",
    HHN: "Frankfurt-Hahn",
    SCN: "Saarbrücken",

    // France
    SXB: "Strasbourg",
    ETZ: "Metz-Nancy-Lorraine",
    DLE: "Dole-Jura",
    LYS: "Lyon",
    GNB: "Grenoble",
    CMF: "Chambéry",
    NCE: "Nice",
    MRS: "Marseille",

    // Italy
    MXP: "Milan Malpensa",
    LIN: "Milan Linate",
    BGY: "Bergamo",
    TRN: "Turin",
    CUF: "Cuneo",
    GOA: "Genoa",
    VRN: "Verona",
    VCE: "Venice",
    TSF: "Treviso",
    TRS: "Trieste",
    BLQ: "Bologna",
    PSA: "Pisa",
    FLR: "Florence",

    // Austria and Luxembourg
    INN: "Innsbruck",
    SZG: "Salzburg",
    LNZ: "Linz",
    KLU: "Klagenfurt",
    LUX: "Luxembourg",
};

/** Whether an OSM `iata` tag (possibly "A;B") names a commercial airport. */
export const isCommercialAirport = (iata: string | undefined) =>
    !!iata &&
    iata
        .split(";")
        .some((code) => code.trim().toUpperCase() in COMMERCIAL_AIRPORTS);
