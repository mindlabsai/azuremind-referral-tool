import { Font } from "@react-pdf/renderer";

const INTER_BASE = "https://fonts.gstatic.com/s/inter/v20";

let interFontsRegistered = false;

if (!interFontsRegistered) {
  interFontsRegistered = true;
  Font.register({
    family: "Inter",
    fonts: [
      {
        src: `${INTER_BASE}/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfMZg.ttf`,
        fontWeight: 400,
      },
      {
        src: `${INTER_BASE}/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuI6fMZg.ttf`,
        fontWeight: 500,
      },
      {
        src: `${INTER_BASE}/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuGKYMZg.ttf`,
        fontWeight: 600,
      },
      {
        src: `${INTER_BASE}/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuFuYMZg.ttf`,
        fontWeight: 700,
      },
      {
        src: `${INTER_BASE}/UcCM3FwrK3iLTcvneQg7Ca725JhhKnNqk4j1ebLhAm8SrXTc2dthjQ.ttf`,
        fontWeight: 400,
        fontStyle: "italic",
      },
    ],
  });
}
