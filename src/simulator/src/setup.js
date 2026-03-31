/* eslint-disable import/no-cycle */
/* eslint-disable no-restricted-syntax */
/* eslint-disable guard-for-in */
import { generateId, showMessage } from './utils'
import { backgroundArea } from './backgroundArea'
import plotArea from './plotArea'
import { simulationArea } from './simulationArea'
import { dots } from './canvasApi'
import { update, updateSimulationSet, updateCanvasSet } from './engine'
import { setupUI } from './ux'
import startMainListeners from './listeners'
import { newCircuit } from './circuit'
import load from './data/load'
import save from './data/save'
import { showTourGuide } from './tutorials'
import setupModules from './moduleSetup'
import 'codemirror/lib/codemirror.css'
import 'codemirror/addon/hint/show-hint.css'
import 'codemirror/mode/javascript/javascript'
import 'codemirror/addon/edit/closebrackets'
import 'codemirror/addon/hint/anyword-hint'
import 'codemirror/addon/hint/show-hint'
import { setupCodeMirrorEnvironment } from './Verilog2CV'
import '../vendor/jquery-ui.min.css'
import '../vendor/jquery-ui.min'
import { confirmSingleOption } from '#/components/helpers/confirmComponent/ConfirmComponent.vue'
import { apiFetch, getAuthToken } from '#/utils/api'

/**
 * To resize window and setup things.
 * Sets up new width for the canvas variables.
 * Also redraws the grid.
 * @category setup
 */
export function resetup() {
    DPR = window.devicePixelRatio || 1
    if (lightMode) {
        DPR = 1
    }
    width = document.getElementById('simulationArea').clientWidth * DPR
    if (!embed) {
        height =
            (document.body.clientHeight -
                document.getElementById('toolbar')?.clientHeight) *
            DPR
    } else {
        height = document.getElementById('simulation').clientHeight * DPR
    }

    backgroundArea.setup()
    simulationArea.setup()
    dots()

    document.getElementById('backgroundArea').style.height =
        height / DPR + 100 + 'px'
    document.getElementById('backgroundArea').style.width =
        width / DPR + 100 + 'px'
    document.getElementById('canvasArea').style.height = height / DPR + 'px'

    simulationArea.canvas.width = width
    simulationArea.canvas.height = height
    backgroundArea.canvas.width = width + 100 * DPR
    backgroundArea.canvas.height = height + 100 * DPR

    if (!embed) {
        plotArea.setup()
    }

    updateCanvasSet(true)
    update()
    simulationArea.prevScale = 0
    dots()
}

window.onresize = resetup
window.onorientationchange = resetup
window.addEventListener('orientationchange', resetup)

/**
 * Function to setup environment variables like projectId and DPR
 * @category setup
 */
function setupEnvironment() {
    setupModules()
    const projectId = generateId()
    window.projectId = projectId
    updateSimulationSet(true)
    newCircuit('Main')
    window.data = {}
    resetup()
    setupCodeMirrorEnvironment()
}

/**
 * Fetches project data from API and loads it into the simulator.
 * Uses apiFetch — works on web (cookies) and Tauri (localStorage token).
 * @param {number} projectId The ID of the project to fetch
 * @category setup
 */
async function fetchProjectData(projectId) {
    try {
        const response = await apiFetch(
            `/api/v1/projects/${projectId}/circuit_data`,
            {
                method: 'GET',
                headers: {
                    Accept: 'application/json',
                    ...(getAuthToken()
                        ? { Authorization: `Token ${getAuthToken()}` }
                        : {}),
                },
            }
        )

        if (response.ok) {
            const data = await response.json()
            await load(data)
            await simulationArea.changeClockTime(data.timePeriod || 500)
            $('.loadingIcon').fadeOut()
        } else {
            throw new Error(`API call failed: ${response.status}`)
        }
    } catch (error) {
        console.error('[setup] fetchProjectData failed:', error)
        confirmSingleOption('Error: Could not load.')
        $('.loadingIcon').fadeOut()
    }
}

/**
 * Load project data when available.
 * @category setup
 */
async function loadProjectData() {
    window.logixProjectId = window.logixProjectId ?? 0

    if (window.logixProjectId !== 0) {
        $('.loadingIcon').fadeIn()
        await fetchProjectData(window.logixProjectId)
    } else if (
        localStorage.getItem('recover_login') &&
        window.isUserLoggedIn
    ) {
        const data = JSON.parse(localStorage.getItem('recover_login'))
        await load(data)
        localStorage.removeItem('recover')
        localStorage.removeItem('recover_login')
        await save()
    } else if (localStorage.getItem('recover')) {
        showMessage(
            "We have detected that you did not save your last work. Don't worry we have recovered them. Access them using Project->Recover"
        )
    }
}

/**
 * Show tour guide if it hasn't been completed yet.
 * @category setup
 */
function showTour() {
    if (!localStorage.tutorials_tour_done && !embed) {
        setTimeout(() => {
            showTourGuide()
        }, 2000)
    }
}

/**
 * The first function called to setup the whole simulator.
 * @category setup
 */
export function setup() {
    setupEnvironment()
    if (!embed) {
        setupUI()
        startMainListeners()
    }
    loadProjectData()
    showTour()
}