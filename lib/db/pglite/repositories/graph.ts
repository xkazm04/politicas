// GraphRepository — person ↔ party/committee ↔ mandate, the static side of the
// civic graph.

import type { GraphRepository } from "../../store";
import type { MandateRow, MembershipRow, OrganRow, PersonRow } from "../../types";
import { limitOf, num, str, upsertMany, warnIfTruncated, type Pglite } from "../internals";
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

/** What a truncation warning must NAME — a read cut off at 1 000 rows tells a very
 *  different story with a person predicate than without one. Same shape as the one
 *  `listAbsences` / `listVoteBallots` build for their own filters. */
const filterLabel = (termCode: string | undefined, ids: readonly number[] | undefined): string | undefined =>
  ids === undefined ? termCode : `${termCode ?? "*"}/persons=${ids.length}`;

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

    // The four listers below order their reads, so an ad-hoc caller limit truncates
    // SYSTEMATICALLY (whatever sorts last is simply absent). `warnIfTruncated` is the
    // same guard the kg listers carry — the relational side used to have none, and
    // `listOrgans({ limit: 2000 })` was reading 1 790 of 1 790 rows, 210 from a silent
    // cliff, for the /zebricek + /poslanec region resolution.
    async listPersons(opts) {
      const lim = limitOf(opts);
      const { rows } = await pg.query<Record<string, unknown>>(
        `select * from person order by psp_id limit ${lim}`,
      );
      warnIfTruncated("listPersons", rows.length, lim);
      return rows.map(mapPerson);
    },
    async listOrgans(opts) {
      const lim = limitOf(opts);
      const { rows } = await pg.query<Record<string, unknown>>(
        `select * from organ order by psp_id limit ${lim}`,
      );
      warnIfTruncated("listOrgans", rows.length, lim);
      return rows.map(mapOrgan);
    },
    async listMandates(opts) {
      const lim = limitOf(opts);
      const ids = opts?.personPspIds;
      // An empty id list is a REAL filter that matches nothing. Dropping it and reading
      // the whole registry instead would be the worst possible reading of "no people
      // selected" (the listVoteBallots / listAbsences precedent).
      if (ids !== undefined && ids.length === 0) return [];
      const clauses: string[] = [];
      const params: unknown[] = [];
      if (opts?.termCode) {
        params.push(opts.termCode);
        clauses.push(`term_code = $${params.length}`);
      }
      if (ids !== undefined) {
        params.push([...ids]);
        // Rides `mandate_person_idx (person_psp_id)` — dead in the DDL until 2026-08-12,
        // while one MP's file read the whole table (all terms) and filtered in JS.
        clauses.push(`person_psp_id = any($${params.length}::int[])`);
      }
      const where = clauses.length > 0 ? `where ${clauses.join(" and ")}` : "";
      const { rows } = await pg.query<Record<string, unknown>>(
        `select * from mandate ${where} order by psp_id limit ${lim}`,
        params,
      );
      warnIfTruncated("listMandates", rows.length, lim, filterLabel(opts?.termCode, ids));
      return rows.map(mapMandate);
    },
    async listMemberships(opts) {
      const lim = limitOf(opts);
      const ids = opts?.personPspIds;
      if (ids !== undefined && ids.length === 0) return [];
      const clauses: string[] = [];
      const params: unknown[] = [];
      // Term scoping for memberships goes through the organ tree: an organ either
      // IS the term chamber or has it as parent.
      if (opts?.termCode) {
        params.push(opts.termCode);
        const p = `$${params.length}`;
        clauses.push(`m.organ_psp_id in (
             select o.psp_id from organ o
             where o.abbrev = ${p} or o.parent_psp_id = (select psp_id from organ where abbrev = ${p})
           )`);
      }
      if (ids !== undefined) {
        params.push([...ids]);
        // Rides `membership_person_idx (person_psp_id)` — the other index this DDL has
        // carried since the first migration with no lister able to use it.
        clauses.push(`m.person_psp_id = any($${params.length}::int[])`);
      }
      const where = clauses.length > 0 ? `where ${clauses.join(" and ")}` : "";
      const { rows } = await pg.query<Record<string, unknown>>(
        `select m.* from membership m ${where} order by m.id limit ${lim}`,
        params,
      );
      warnIfTruncated("listMemberships", rows.length, lim, filterLabel(opts?.termCode, ids));
      // Same "unknown term vs. genuinely empty term" ambiguity as
      // votes.ts's listAbsences — one cheap existence check only on the
      // empty-result path. It stays on the person-scoped path too: an empty answer
      // there is COMMON (this MP did not sit in that term), which is exactly the state
      // in which a typo'd term code would otherwise be indistinguishable from a fact.
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
