// Cesium Ion Access Token
Cesium.Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJhY2VjYWRlNC00MzhiLTRmYTAtYTI5Mi0zYzE1Zjc2OWM5MjkiLCJpZCI6MjQ0MDU5LCJpYXQiOjE3Mjc4NDk1NTV9.Hq8fKKaTCKFZd0bnVRySAoXh4akmaaM8wyVCC0E8UU0';

// Global variables
let viewer;
let drawnPoints = [];
let activeHandler = null;

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    initializeCesium();
    setupEventListeners();
});

function initializeCesium() {
    // Create Cesium Viewer
    viewer = new Cesium.Viewer('cesiumContainer', {
        terrainProvider: Cesium.createWorldTerrain(),
        timeline: false,
        animation: false,
        baseLayerPicker: false,
        sceneModePicker: false,
        navigationHelpButton: false,
        homeButton: false,
        geocoder: false,
        infoBox: false,
        selectionIndicator: false,
        shouldAnimate: true
    });

    // Enable lighting
    viewer.scene.globe.enableLighting = true;
    
    // Set initial view
    viewer.camera.setView({
        destination: Cesium.Cartesian3.fromDegrees(-75.59777, 40.03883, 20000000),
        orientation: {
            heading: 0.0,
            pitch: -Cesium.Math.PI_OVER_TWO,
            roll: 0.0
        }
    });
}

function setupEventListeners() {
    // Home button - reset view
    document.getElementById('homeButton').addEventListener('click', () => {
        viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(-75.59777, 40.03883, 20000000),
            orientation: {
                heading: 0.0,
                pitch: -Cesium.Math.PI_OVER_TWO,
                roll: 0.0
            }
        });
    });

    // About button
    document.getElementById('aboutButton').addEventListener('click', () => {
        alert('CesiumJS Map Application\nVersion 1.0\n\nClick "Drawing Tools" to draw points on the map.');
    });

    // Draw Points button
    document.getElementById('drawPointButton').addEventListener('click', (event) => {
        event.preventDefault();
        enableDrawPointMode();
    });

    // Save Points button
    document.getElementById('saveButton').addEventListener('click', (event) => {
        event.preventDefault();
        savePointsToFile();
    });

    // Load Points button
    document.getElementById('loadButton').addEventListener('click', (event) => {
        event.preventDefault();
        document.getElementById('fileInput').click();
    });

    // File input handler
    document.getElementById('fileInput').addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            loadPointsFromFile(file);
        }
    });

    // Clear Points button
    document.getElementById('clearButton').addEventListener('click', (event) => {
        event.preventDefault();
        clearAllPoints();
    });
}

function enableDrawPointMode() {
    // Remove any existing handler
    if (activeHandler) {
        activeHandler.destroy();
    }

    // Create new handler for drawing points
    activeHandler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    
    activeHandler.setInputAction((movement) => {
        const cartesian = viewer.camera.pickEllipsoid(movement.position, viewer.scene.globe.ellipsoid);
        
        if (cartesian) {
            const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
            const longitude = Cesium.Math.toDegrees(cartographic.longitude);
            const latitude = Cesium.Math.toDegrees(cartographic.latitude);
            const height = cartographic.height;

            // Add point to the map
            const pointEntity = viewer.entities.add({
                position: cartesian,
                point: {
                    pixelSize: 10,
                    color: Cesium.Color.RED,
                    outlineColor: Cesium.Color.WHITE,
                    outlineWidth: 2
                },
                label: {
                    text: `Point ${drawnPoints.length + 1}`,
                    font: '12pt Arial',
                    style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                    outlineWidth: 2,
                    verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                    pixelOffset: new Cesium.Cartesian2(0, -10)
                }
            });

            // Store point data
            drawnPoints.push({
                longitude,
                latitude,
                height,
                entity: pointEntity
            });

            updateWKTLabel();
        }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    alert('Click on the map to draw points. Click "Save Points to File" to export.');
}

function updateWKTLabel() {
    const wktDiv = document.getElementById('wktDiv');
    const wktLabel = document.getElementById('wktLabel');
    
    if (drawnPoints.length > 0) {
        const wktStrings = drawnPoints.map((point, index) => 
            `POINT ${index + 1}: (${point.longitude.toFixed(6)} ${point.latitude.toFixed(6)})`
        ).join('\n');
        
        wktLabel.textContent = wktStrings;
        wktDiv.style.display = 'block';
    } else {
        wktDiv.style.display = 'none';
    }
}

function savePointsToFile() {
    if (drawnPoints.length === 0) {
        alert('No points to save!');
        return;
    }

    // Format data as CSV
    let fileContent = 'Longitude,Latitude,Height\n';
    drawnPoints.forEach(point => {
        fileContent += `${point.longitude.toFixed(6)},${point.latitude.toFixed(6)},${point.height.toFixed(2)}\n`;
    });

    // Create download link
    const blob = new Blob([fileContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `cesium_points_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

function loadPointsFromFile(file) {
    const reader = new FileReader();
    
    reader.onload = (e) => {
        try {
            const content = e.target.result;
            const lines = content.split('\n');
            
            // Clear existing points if any
            clearAllPoints(false); // Don't show confirmation
            
            // Skip header if exists
            const startLine = lines[0].includes('Longitude') ? 1 : 0;
            
            for (let i = startLine; i < lines.length; i++) {
                if (lines[i].trim() === '') continue;
                
                const parts = lines[i].split(',');
                if (parts.length >= 2) {
                    const lon = parseFloat(parts[0]);
                    const lat = parseFloat(parts[1]);
                    const height = parts.length >= 3 ? parseFloat(parts[2]) : 0;
                    
                    if (!isNaN(lon) && !isNaN(lat)) {
                        const cartesian = Cesium.Cartesian3.fromDegrees(lon, lat, height);
                        
                        // Add point to the map
                        const pointEntity = viewer.entities.add({
                            position: cartesian,
                            point: {
                                pixelSize: 10,
                                color: Cesium.Color.BLUE,
                                outlineColor: Cesium.Color.WHITE,
                                outlineWidth: 2
                            },
                            label: {
                                text: `Loaded ${drawnPoints.length + 1}`,
                                font: '12pt Arial',
                                style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                                outlineWidth: 2,
                                verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                                pixelOffset: new Cesium.Cartesian2(0, -10)
                            }
                        });
                        
                        // Store point data
                        drawnPoints.push({
                            longitude: lon,
                            latitude: lat,
                            height: height,
                            entity: pointEntity
                        });
                    }
                }
            }
            
            updateWKTLabel();
            
            if (drawnPoints.length > 0) {
                // Zoom to the loaded points
                viewer.zoomTo(viewer.entities);
                
                alert(`Successfully loaded ${drawnPoints.length} points from file.`);
            } else {
                alert('No valid points found in the file.');
            }
        } catch (error) {
            console.error('Error loading file:', error);
            alert('Error loading file. Please check the file format.');
        }
    };
    
    reader.onerror = () => {
        alert('Error reading file.');
    };
    
    reader.readAsText(file);
}

function clearAllPoints(showConfirmation = true) {
    if (drawnPoints.length === 0) {
        if (showConfirmation) alert('No points to clear!');
        return;
    }

    if (!showConfirmation || confirm('Are you sure you want to clear all points?')) {
        // Remove all entities
        drawnPoints.forEach(point => {
            viewer.entities.remove(point.entity);
        });
        
        // Clear the array
        drawnPoints = [];
        
        // Hide WKT label
        document.getElementById('wktDiv').style.display = 'none';
    }
}