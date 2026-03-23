import { defineStore } from "pinia";
import { ref } from "vue";

export const useVerilogStore = defineStore("verilogStore", () => {
  const isTerminalVisible = ref(false);
  const selectedTheme = ref(localStorage.getItem("verilog-theme") || "default");

  // ── Progress bar state ──────────────────────────────────────
  const isSynthesizing = ref(false);
  const synthProgress  = ref(0);
  const synthStage     = ref('');
  const synthColor     = ref('#4dabf7');
  const synthTime      = ref('');
  let   _synthStart    = 0

  const STAGES = [
    { label: 'Loading WASM',    pct: 10, color: '#f59f00' },
    { label: 'Parsing Verilog', pct: 30, color: '#4dabf7' },
    { label: 'Synthesizing',    pct: 55, color: '#fd7e14' },
    { label: 'Running Layout',  pct: 80, color: '#cc5de8' },
    { label: 'Rendering',       pct: 95, color: '#51cf66' },
  ]

  const setSynthStage = (index: number) => {
    const s = STAGES[index]
    if (!s) return
    if (index === 0) _synthStart = Date.now()
    isSynthesizing.value = true
    synthProgress.value  = s.pct
    synthStage.value     = s.label
    synthColor.value     = s.color
    synthTime.value      = ''
  }

  const finishSynthesis = () => {
    const elapsed = ((Date.now() - _synthStart) / 1000).toFixed(1)
    synthProgress.value  = 100
    synthStage.value     = 'Done'
    synthColor.value     = '#51cf66'
    synthTime.value      = `${elapsed}s`
    setTimeout(() => {
      isSynthesizing.value = false
      synthProgress.value  = 0
      synthStage.value     = ''
      synthColor.value     = '#4dabf7'
      synthTime.value      = ''
    }, 3000)
  }

  const resetSynthesis = () => {
    isSynthesizing.value = false
    synthProgress.value  = 0
    synthStage.value     = ''
    synthColor.value     = '#4dabf7'
    synthTime.value      = ''
  }
  // ────────────────────────────────────────────────────────────

  const toggleTerminal = () => { isTerminalVisible.value = !isTerminalVisible.value }
  const showTerminal   = () => { isTerminalVisible.value = true }
  const hideTerminal   = () => { isTerminalVisible.value = false }
  const setTheme = (theme: string) => {
    selectedTheme.value = theme
    localStorage.setItem("verilog-theme", theme)
  }

  return {
    isTerminalVisible,
    toggleTerminal,
    showTerminal,
    hideTerminal,
    selectedTheme,
    setTheme,
    isSynthesizing,
    synthProgress,
    synthStage,
    synthColor,
    synthTime,
    setSynthStage,
    finishSynthesis,
    resetSynthesis,
  };
});