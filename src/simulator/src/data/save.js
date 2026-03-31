import { scopeList } from '../circuit'
import { resetup } from '../setup'
import { update, updateSubcircuitSet } from '../engine'
import { stripTags, showMessage } from '../utils'
import { backUp } from './backupCircuit'
import { simulationArea } from '../simulationArea'
import { backgroundArea } from '../backgroundArea'
import { findDimensions } from '../canvasApi'
import { projectSavedSet } from './project'
import { colors } from '../themer/themer'
import { layoutModeGet, toggleLayoutMode } from '../layoutMode'
import { verilogModeGet } from '../Verilog2CV'
import domtoimage from 'dom-to-image'
import canvasToSvg from 'canvas-to-svg'
import { useProjectStore } from '#/store/projectStore'
import { provideProjectName } from '#/components/helpers/promptComponent/PromptComponent.vue'
import { UpdateProjectDetail } from '#/components/helpers/createNewProject/UpdateProjectDetail.vue'
import { confirmOption } from '#/components/helpers/confirmComponent/ConfirmComponent.vue'
import { apiFetch, getAuthToken } from '#/utils/api'
import { renderOrder } from '../metadata'

/**
 * Function to set the name of project.
 * @param {string} name - name for project
 * @category data
 */
export function setProjectName(name) {
    const projectStore = useProjectStore()
    if (name == undefined) return
    name = stripTags(name)
    projectStore.setProjectName(name)
}

/**
 * Function to get the name of project.
 * @category data
 */
export function getProjectName() {
    const projectStore = useProjectStore()
    if (projectStore.getProjectNameDefined)
        return projectStore.getProjectName.trim()
    else return undefined
}

/**
 * Helper function to save canvas as image based on image type
 * @param {string} name - name of the circuit
 * @param {string} imgType - image type ex: png, jpg etc.
 * @category data
 */
function downloadAsImg(name, imgType) {
    const gh = simulationArea.canvas.toDataURL(`image/${imgType}`)
    const anchor = document.createElement('a')
    anchor.href = gh
    anchor.download = `${name}.${imgType}`
    anchor.click()
}

/**
 * Returns the order of tabs in the project
 */
export function getTabsOrder() {
    var tabs = document.getElementById('tabsBar').firstChild.children
    var order = []
    for (let i = 0; i < tabs?.length; i++) {
        order.push(tabs[i].id)
    }
    return order
}

/**
 * Generates JSON of the entire project
 * @param {string} name - the name of project
 * @return {JSON}
 * @category data
 */
export async function generateSaveData(name, setName = true) {
    let data = {}

    name = getProjectName() || name || (await provideProjectName())
    if (name instanceof Error) {
        return new Error('cancel')
    } else if (name == '') {
        name = 'Untitled'
    }
    data.name = stripTags(name)
    if (setName) setProjectName(data.name)

    data.timePeriod = simulationArea.timePeriod
    data.clockEnabled = simulationArea.clockEnabled
    data.projectId = projectId
    data.focussedCircuit = globalScope.id
    data.orderedTabs = getTabsOrder()

    data.scopes = []
    const dependencyList = {}
    const completed = {}

    for (id in scopeList) {
        dependencyList[id] = scopeList[id].getDependencies()
    }

    function saveScope(id) {
        if (completed[id]) return
        for (let i = 0; i < dependencyList[id].length; i++) {
            saveScope(dependencyList[id][i])
        }
        completed[id] = true
        updateSubcircuitSet(true)
        update(scopeList[id], true)
        data.scopes.push(backUp(scopeList[id]))
    }

    for (let id in scopeList) {
        saveScope(id)
    }

    return data
}

// Helper function to download text
function download(filename, text) {
    var pom = document.createElement('a')
    pom.setAttribute(
        'href',
        'data:text/plain;charset=utf-8,' + encodeURIComponent(text)
    )
    pom.setAttribute('download', filename)

    if (document.createEvent) {
        var event = document.createEvent('MouseEvents')
        event.initEvent('click', true, true)
        pom.dispatchEvent(event)
    } else {
        pom.click()
    }
}

/**
 * Function to generate image for the circuit
 * @param {string} imgType - ex: png, jpg etc.
 * @param {string} view - view type ex: full
 * @param {boolean} transparent - transparent bg or not
 * @param {number} resolution - resolution of the image
 * @param {boolean=} down - will download if true
 * @category data
 */
export function generateImage(
    imgType,
    view,
    transparent,
    resolution,
    down = true
) {
    const backUpOx = globalScope.ox
    const backUpOy = globalScope.oy
    const backUpWidth = width
    const backUpHeight = height
    const backUpScale = globalScope.scale
    const backUpContextBackground = backgroundArea.context
    const backUpContextSimulation = simulationArea.context

    backgroundArea.context = simulationArea.context

    globalScope.ox *= 1 / backUpScale
    globalScope.oy *= 1 / backUpScale

    if (imgType === 'svg') {
        simulationArea.context = new canvasToSvg(width, height)
        resolution = 1
    } else if (imgType !== 'png') {
        transparent = false
    }

    globalScope.scale = resolution

    const scope = globalScope

    var flag = 1
    if (flag) {
        if (view === 'full') {
            findDimensions()
            const minX = simulationArea.minWidth
            const minY = simulationArea.minHeight
            const maxX = simulationArea.maxWidth
            const maxY = simulationArea.maxHeight
            width = (maxX - minX + 100) * resolution
            height = (maxY - minY + 100) * resolution
            globalScope.ox = (-minX + 50) * resolution
            globalScope.oy = (-minY + 50) * resolution
        } else {
            globalScope.ox *= resolution
            globalScope.oy *= resolution
            width = (width * resolution) / backUpScale
            height = (height * resolution) / backUpScale
        }
    }

    globalScope.ox = Math.round(globalScope.ox)
    globalScope.oy = Math.round(globalScope.oy)

    simulationArea.canvas.width = width
    simulationArea.canvas.height = height
    backgroundArea.canvas.width = width
    backgroundArea.canvas.height = height

    backgroundArea.context = simulationArea.context
    simulationArea.clear()

    if (!transparent) {
        simulationArea.context.fillStyle = colors['canvas_fill']
        simulationArea.context.rect(0, 0, width, height)
        simulationArea.context.fill()
    }

    for (let i = 0; i < renderOrder.length; i++) {
        for (let j = 0; j < scope[renderOrder[i]].length; j++) {
            scope[renderOrder[i]][j].draw()
        }
    }

    let returnData
    if (down) {
        if (imgType === 'svg') {
            const mySerializedSVG = simulationArea.context.getSerializedSvg()
            download(`${globalScope.name}.svg`, mySerializedSVG)
        } else {
            downloadAsImg(globalScope.name, imgType)
        }
    } else {
        returnData = simulationArea.canvas.toDataURL(`image/${imgType}`)
    }

    width = backUpWidth
    height = backUpHeight
    simulationArea.canvas.width = width
    simulationArea.canvas.height = height
    backgroundArea.canvas.width = width
    backgroundArea.canvas.height = height
    globalScope.scale = backUpScale
    backgroundArea.context = backUpContextBackground
    simulationArea.context = backUpContextSimulation
    globalScope.ox = backUpOx
    globalScope.oy = backUpOy

    resetup()

    if (!down) return returnData
}

async function crop(dataURL, w, h) {
    var myCanvas = document.createElement('CANVAS')
    myCanvas.width = w
    myCanvas.height = h
    var myContext = myCanvas.getContext('2d')
    var img = new Image()
    return new Promise(function (resolved) {
        img.src = dataURL
        img.onload = () => {
            myContext.drawImage(img, 0, 0, w, h, 0, 0, w, h)
            myContext.save()
            resolved(myCanvas.toDataURL('image/jpeg'))
        }
    })
}

/**
 * Function that is used to save image for display in the website
 * @return {JSON}
 * @category data
 */
async function generateImageForOnline() {
    var ratio = 1.6
    if (verilogModeGet()) {
        var node = document.getElementsByClassName('CodeMirror')[0]
        var prevHeight = window.getComputedStyle(node).height
        var prevWidth = window.getComputedStyle(node).width
        var baseWidth = 500
        var baseHeight = Math.round(baseWidth / ratio)
        node.style.height = baseHeight + 'px'
        node.style.width = baseWidth + 'px'
        var data = await domtoimage.toJpeg(node)
        node.style.width = prevWidth
        node.style.height = prevHeight
        data = await crop(data, baseWidth, baseHeight)
        return data
    }

    simulationArea.lastSelected = undefined

    if (width > height * ratio) {
        height = width / ratio
    } else {
        width = height * 1.6
    }

    globalScope.centerFocus()

    const resolution = Math.min(
        700 / (simulationArea.maxWidth - simulationArea.minWidth),
        440 / (simulationArea.maxHeight - simulationArea.minHeight)
    )

    data = generateImage('jpeg', 'current', false, resolution, false)
    globalScope.centerFocus(false)
    return data
}

/**
 * Build auth headers for API calls.
 * Works on web (cookie token) and Tauri (localStorage token).
 * @category data
 */
function buildAuthHeaders() {
    const token = getAuthToken()
    return {
        'Content-Type': 'application/json',
        'X-CSRF-Token': document
            .querySelector('meta[name="csrf-token"]')
            ?.getAttribute('content'),
        ...(token ? { Authorization: `Token ${token}` } : {}),
    }
}

/**
 * Function called when you save a circuit online
 * @category data
 * @exports save
 */
export default async function save() {
    if (layoutModeGet()) toggleLayoutMode()

    projectSavedSet(true)

    const data = await generateSaveData()
    if (data instanceof Error) return

    let loadingIcon = document.querySelector('.loadingIcon')
    loadingIcon.style.transition = 'opacity 0.5s linear'
    loadingIcon.style.opacity = '1'

    const projectName = getProjectName()
    var imageData = await generateImageForOnline()

    const headers = buildAuthHeaders()

    if (!window.isUserLoggedIn) {
        // User not signed in — save locally and prompt login
        localStorage.setItem('recover_login', data)
        if (
            await confirmOption(
                'You have to login to save the project, you will be redirected to the login page.'
            )
        ) {
            window.location.href = '/users/sign_in'
        } else {
            loadingIcon = document.querySelector('.loadingIcon')
            loadingIcon.style.transition = 'opacity 0.2s'
            loadingIcon.style.opacity = '0'
        }

    } else if ([0, undefined, null, '', '0'].includes(window.logixProjectId)) {
        // Create new project
        apiFetch('/api/v1/projects', {
            method: 'POST',
            headers,
            body: JSON.stringify({
                data,
                image: imageData,
                name: projectName,
            }),
        })
            .then((response) => {
                if (response.ok) {
                    showMessage(
                        `We have Created a new project: ${projectName} in our servers.`
                    )
                    loadingIcon = document.querySelector('.loadingIcon')
                    loadingIcon.style.transition = 'opacity 0.2s'
                    loadingIcon.style.opacity = '0'
                    localStorage.removeItem('recover')
                    response.json().then((data) => {
                        UpdateProjectDetail(data)
                    })
                }
            })
            .catch((error) => {
                console.error('[save] Create project error:', error)
            })

    } else {
        // Update existing project
        apiFetch('/api/v1/projects/update_circuit', {
            method: 'PATCH',
            headers,
            body: JSON.stringify({
                data,
                id: window.logixProjectId,
                image: imageData,
                name: projectName,
            }),
        })
            .then((response) => {
                if (response.ok) {
                    showMessage(
                        `We have saved your project: ${projectName} in our servers.`
                    )
                    localStorage.removeItem('recover')
                } else {
                    showMessage(
                        "There was an error, we couldn't save to our servers"
                    )
                }
                loadingIcon = document.querySelector('.loadingIcon')
                loadingIcon.style.transition = 'opacity 0.2s'
                loadingIcon.style.opacity = '0'
            })
            .catch((error) => {
                console.error('[save] Update project error:', error)
            })
    }

    resetup()
}