"use client";

import { useMemo } from "react";

import {
  ADHD_CRITERIA,
  deriveAdhdPresentation,
  type AdhdCriterion,
} from "./adhd-engine-core";
import {
  buildFormulationPrompt,
  type AdhdFormulationBrief,
} from "./adhd-formulation";
import {
  detectDifferentialChannels,
  type ChannelResult,
} from "./adhd-differential-channels";
import {
  detectAsdDifferential,
  type AsdDifferentialResult,
} from "./adhd-asd-differential";
import {
  screenMentalHealth,
  type MentalHealthScreen,
} from "./adhd-mental-health-screen";
import { formatAsdDifferential } from "./adhd-differential-format";
import { expandRecommendations, type RecInput } from "./adhd-recommendations";

export type DivaState = "positive" | "negative" | "not-administered";

export type AdhdCriterionState = "met" | "not-met" | "unset";

export type AdhdClinicianInput = {
  childName: string;
  ageYears: number;
  chronologicalAgeLabel: string;
  yearLevel: string;
  school: string;
  parent1: string;
  parent2: string;
  parent1Relationship: string;
  parent2Relationship: string;
  attendingParents: string[];
  assessmentDate: string;
  assessmentModality: string;
  divaState: DivaState;
  criteriaStates: Record<string, AdhdCriterionState>;
  severityStated: string | null;
  asdActive: boolean;
  clinicianStatedFraming: string;
  mentalHealthFraming: string | null;
  recommendationShorthand: string[];
  medicationWanted: boolean;
  mentalHealthGreenLight: boolean;
};

export type AdhdCriteriaCounts = {
  inattentionMet: number;
  hyperactivityMet: number;
  inattentionTotal: number;
  hyperactivityTotal: number;
};

export type AdhdPresentationDerivation = {
  presentation: string | null;
  iaPositive: boolean;
  hiPositive: boolean;
  threshold: number;
};

function splitCriteria(criteria: AdhdCriterion[]): {
  inattention: AdhdCriterion[];
  hyperactivity: AdhdCriterion[];
} {
  const inattention: AdhdCriterion[] = [];
  const hyperactivity: AdhdCriterion[] = [];
  for (const c of criteria) {
    if (/^IA/i.test(c.code)) inattention.push(c);
    else if (/^HI/i.test(c.code)) hyperactivity.push(c);
  }
  return { inattention, hyperactivity };
}

function countMet(
  criteria: AdhdCriterion[],
  states: Record<string, AdhdCriterionState>
): number {
  let n = 0;
  for (const c of criteria) {
    if (states[c.code] === "met") n += 1;
  }
  return n;
}

export type AdhdPipelineResult = {
  criteria: {
    inattention: AdhdCriterion[];
    hyperactivity: AdhdCriterion[];
  };
  counts: AdhdCriteriaCounts;
  presentation: AdhdPresentationDerivation;
  channels: ChannelResult[];
  asdDifferential: AsdDifferentialResult;
  asdDifferentialBlock: string;
  mentalHealth: MentalHealthScreen;
  formulationPrompt: string;
  recommendations: string[];
  brief: AdhdFormulationBrief;
};

export function useAdhdEnginePipeline(
  rawNotes: string,
  input: AdhdClinicianInput
): AdhdPipelineResult {
  const criteriaSplit = useMemo(() => splitCriteria(ADHD_CRITERIA), []);

  const counts = useMemo<AdhdCriteriaCounts>(
    () => ({
      inattentionMet: countMet(criteriaSplit.inattention, input.criteriaStates),
      hyperactivityMet: countMet(criteriaSplit.hyperactivity, input.criteriaStates),
      inattentionTotal: criteriaSplit.inattention.length,
      hyperactivityTotal: criteriaSplit.hyperactivity.length,
    }),
    [criteriaSplit, input.criteriaStates]
  );

  const presentation = useMemo<AdhdPresentationDerivation>(() => {
    const derived = deriveAdhdPresentation(
      counts.inattentionMet,
      counts.hyperactivityMet,
      input.ageYears
    );
    if (input.divaState !== "positive") {
      return { ...derived, presentation: null };
    }
    return derived;
  }, [
    input.divaState,
    input.ageYears,
    counts.inattentionMet,
    counts.hyperactivityMet,
  ]);

  const channels = useMemo(() => detectDifferentialChannels(rawNotes), [rawNotes]);

  const asdDifferential = useMemo(() => detectAsdDifferential(rawNotes), [rawNotes]);
  const asdDifferentialBlock = useMemo(
    () => formatAsdDifferential(rawNotes).block,
    [rawNotes]
  );

  const mentalHealth = useMemo(
    () => screenMentalHealth(rawNotes, input.mentalHealthGreenLight),
    [rawNotes, input.mentalHealthGreenLight]
  );

  const channelSummaries = useMemo(
    () =>
      channels
        .filter((c) => c.state !== "not-indicated")
        .map((c) =>
          c.state === "present-investigate"
            ? c.channel + ": indicated, not yet assessed (ratify with " + c.ratifyingAssessment + ")"
            : c.channel + ": indicated and assessed"
        ),
    [channels]
  );

  const brief = useMemo<AdhdFormulationBrief>(
    () => ({
      childName: input.childName,
      ageYears: input.ageYears,
      chronologicalAgeLabel: input.chronologicalAgeLabel,
      yearLevel: input.yearLevel,
      school: input.school,
      parent1: input.parent1,
      parent2: input.parent2,
      parent1Relationship: input.parent1Relationship,
      parent2Relationship: input.parent2Relationship,
      attendingParents: input.attendingParents,
      assessmentDate: input.assessmentDate,
      assessmentModality: input.assessmentModality,
      divaState: input.divaState,
      presentation: presentation.presentation,
      severityStated: input.severityStated,
      criteriaStates: input.criteriaStates,
      inattentionMet: counts.inattentionMet,
      inattentionTotal: counts.inattentionTotal,
      hyperactivityMet: counts.hyperactivityMet,
      hyperactivityTotal: counts.hyperactivityTotal,
      threshold: presentation.threshold,
      asdDifferentialBlock,
      asdActive: input.asdActive,
      channelSummaries,
      riskPresent: mentalHealth.risk.present,
      mentalHealthFraming: input.mentalHealthFraming,
      clinicianStatedFraming: input.clinicianStatedFraming,
    }),
    [
      input.childName,
      input.ageYears,
      input.chronologicalAgeLabel,
      input.yearLevel,
      input.school,
      input.parent1,
      input.parent2,
      input.parent1Relationship,
      input.parent2Relationship,
      input.attendingParents,
      input.assessmentDate,
      input.assessmentModality,
      input.divaState,
      presentation.presentation,
      presentation.threshold,
      input.severityStated,
      input.criteriaStates,
      counts.inattentionMet,
      counts.inattentionTotal,
      counts.hyperactivityMet,
      counts.hyperactivityTotal,
      asdDifferentialBlock,
      input.asdActive,
      channelSummaries,
      mentalHealth.risk.present,
      input.mentalHealthFraming,
      input.clinicianStatedFraming,
    ]
  );

  const formulationPrompt = useMemo(() => buildFormulationPrompt(brief), [brief]);

  const recommendations = useMemo<string[]>(() => {
    const recInput: RecInput = {
      shorthand: input.recommendationShorthand,
      ageYears: input.ageYears,
      riskPresent: mentalHealth.risk.present,
      medicationWanted: input.medicationWanted,
    };
    return expandRecommendations(recInput);
  }, [
    input.recommendationShorthand,
    input.ageYears,
    mentalHealth.risk.present,
    input.medicationWanted,
  ]);

  return {
    criteria: criteriaSplit,
    counts,
    presentation,
    channels,
    asdDifferential,
    asdDifferentialBlock,
    mentalHealth,
    formulationPrompt,
    recommendations,
    brief,
  };
}
