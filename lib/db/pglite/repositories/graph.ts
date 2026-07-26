// GraphRepository — person ↔ party/committee ↔ mandate, the static side of the
// civic graph.

import type { GraphRepository } from "../../store";
import type { MandateRow, MembershipRow, OrganRow, PersonRow } from "../../types";
import { limitOf, num, str, upsertMany, type Pglite } from "../internals";
import {
  MANDATE_COLS,
  MEMBERSHIP_COLS,
  ORGAN_COLS,
  PERSON_COLS,
  mapMandate,
  mapMembership,
  mapOrgan,
  mapPerson,
} from "../mappers";

export function makeGraphRepo(pg: Pglite): GraphRepository {
  return {
    upsertPersons: (rows) =>
      upsertMany(pg, "person", PERSON_COLS, rows, (r: PersonRow) => [
        r.id, r.pspId, r.titleBefore, r.firstName, r.lastName, r.titleAfter, r.nameFull,
        r.nameNorm, r.birthDate, r.birthDateUnknown, r.gender, r.diedAt, r.changedAt,
        r.source, r.sourceUrl, r.fetchedAt, r.ingestRunId, JSON.stringify(r.raw),
      ]),
    upsertOrgans: (rows) =>
      upsertMany(pg, "organ", ORGAN_COLS, rows, (r: OrganRow) => [
        r.id, r.pspId, r.parentPspId, r.organTypeId, r.organTypeCz, r.abbrev, r.nameCz,
        r.nameEn, r.nameNorm, r.validFrom, r.validTo,
        r.source, r.sourceUrl, r.fetchedAt, r.ingestRunId, JSON.stringify(r.raw),
      ]),
    upsertMandates: (rows) =>
      upsertMany(pg, "mandate", MANDATE_COLS, rows, (r: MandateRow) => [
        r.id, r.pspId, r.personPspId, r.termPspId, r.termCode, r.regionPspId,
        r.partyListPspId, r.web, r.email, r.phone, r.pspPhone, r.facebook, r.hasPhoto,
        r.source, r.sourceUrl, r.fetchedAt, r.ingestRunId, JSON.stringify(r.raw),
      ]),
    upsertMemberships: (rows) =>
      upsertMany(pg, "membership", MEMBERSHIP_COLS, rows, (r: MembershipRow) => [
        r.id, r.personPspId, r.kind, r.targetPspId, r.organPspId, r.functionNameCz,
        r.functionTypeCz, r.fromAt, r.toAt, r.mandateFrom, r.mandateTo,
        r.source, r.sourceUrl, r.fetchedAt, r.ingestRunId, JSON.stringify(r.raw),
      ]),

    async listPersons(opts) {
      const { rows } = await pg.query<Record<string, unknown>>(
        `select * from person order by psp_id limit ${limitOf(opts)}`,
      );
      return rows.map(mapPerson);
    },
    async listOrgans(opts) {
      const { rows } = await pg.query<Record<string, unknown>>(
        `select * from organ order by psp_id limit ${limitOf(opts)}`,
      );
      return rows.map(mapOrgan);
    },
    async listMandates(opts) {
      const where = opts?.termCode ? `where term_code = $1` : "";
      const { rows } = await pg.query<Record<string, unknown>>(
        `select * from mandate ${where} order by psp_id limit ${limitOf(opts)}`,
        opts?.termCode ? [opts.termCode] : [],
      );
      return rows.map(mapMandate);
    },
    async listMemberships(opts) {
      // Term scoping for memberships goes through the organ tree: an organ either
      // IS the term chamber or has it as parent.
      const where = opts?.termCode
        ? `where m.organ_psp_id in (
             select o.psp_id from organ o
             where o.abbrev = $1 or o.parent_psp_id = (select psp_id from organ where abbrev = $1)
           )`
        : "";
      const { rows } = await pg.query<Record<string, unknown>>(
        `select m.* from membership m ${where} order by m.id limit ${limitOf(opts)}`,
        opts?.termCode ? [opts.termCode] : [],
      );
      // Same "unknown term vs. genuinely empty term" ambiguity as
      // votes.ts's listAbsences — one cheap existence check only on the
      // empty-result path.
      if (rows.length === 0 && opts?.termCode) {
        const { rows: organRows } = await pg.query(`select 1 from organ where abbrev = $1`, [opts.termCode]);
        if (organRows.length === 0) {
          console.warn(`[listMemberships] termCode "${opts.termCode}" does not resolve to any organ — returning empty`);
        }
      }
      return rows.map(mapMembership);
    },

    async clubByMandate(termCode) {
      const { rows } = await pg.query<Record<string, unknown>>(
        `with term as (select psp_id from organ where abbrev = $1),
              club as (
                select o.psp_id, o.abbrev
                from organ o, term t
                where o.parent_psp_id = t.psp_id and o.organ_type_cz = 'Klub'
              )
         select mn.psp_id as mandate_psp_id, club.abbrev
           from mandate mn
           join term t on mn.term_psp_id = t.psp_id
           join membership ms on ms.person_psp_id = mn.person_psp_id and ms.kind = 'member'
           join club on club.psp_id = ms.organ_psp_id`,
        [termCode],
      );
      const out = new Map<number, string>();
      for (const r of rows) out.set(num(r.mandate_psp_id), str(r.abbrev));
      return out;
    },
  };
}
