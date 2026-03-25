         import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js'; 
 
         // --- Scene Setup --- 
         const scene = new THREE.Scene(); 
         // No background color set on scene to let CSS gradient show through 
         
         const aspect = window.innerWidth / window.innerHeight; 
         const d = 21; // Zoom level 
         const camera = new THREE.OrthographicCamera(-d * aspect, d * aspect, d, -d, 1, 1000); 
         camera.position.set(50, 50, 50); 
         camera.lookAt(0, 0, 0); 
 
         const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); 
         renderer.setSize(window.innerWidth, window.innerHeight); 
         renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); 
         renderer.shadowMap.enabled = true; 
         renderer.shadowMap.type = THREE.PCFSoftShadowMap; 
         const threeContainer = document.getElementById('three-container');
         if (threeContainer) {
            threeContainer.appendChild(renderer.domElement);
         } 
 
         // --- Lights --- 
         const hemiLight = new THREE.HemisphereLight(0xffffff, 0xdddddd, 1.8); 
         scene.add(hemiLight); 
 
         const dirLight = new THREE.DirectionalLight(0xffffff, 3.0); 
         dirLight.position.set(20, 40, 20); 
         dirLight.castShadow = true; 
         dirLight.shadow.mapSize.width = 2048; 
         dirLight.shadow.mapSize.height = 2048; 
         scene.add(dirLight); 
 
         // --- Ground (Shadow Only) --- 
         const ground = new THREE.Mesh( 
             new THREE.PlaneGeometry(2000, 2000), 
             new THREE.ShadowMaterial({ opacity: 0.1 }) 
         ); 
         ground.rotation.x = -Math.PI / 2; 
         ground.receiveShadow = true; 
         scene.add(ground); 
 
         // --- Helper Functions --- 
         function createLocomotive(color) { 
             const group = new THREE.Group(); 
             const scale = 1.5; 
 
             const bodyMat = new THREE.MeshStandardMaterial({ color: color, roughness: 0.4, metalness: 0.6 }); 
             const blackMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.5, metalness: 0.5 }); 
             const redMat = new THREE.MeshStandardMaterial({ color: 0xe11d48, roughness: 0.4, metalness: 0.3 }); 
             const goldMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.3, metalness: 0.8 }); 
             const windowMat = new THREE.MeshStandardMaterial({ color: 0xbae6fd, roughness: 0.2, metalness: 0.8 }); 
 
             // Boiler 
             const boiler = new THREE.Mesh(new THREE.CylinderGeometry(0.6 * scale, 0.6 * scale, 2.2 * scale, 16), bodyMat); 
             boiler.rotation.x = Math.PI / 2; 
             boiler.position.set(0, 1.1 * scale, 0.5 * scale); 
             group.add(boiler); 
 
             // Cab 
             const cab = new THREE.Mesh(new THREE.BoxGeometry(1.4 * scale, 1.6 * scale, 1.2 * scale), bodyMat); 
             cab.position.set(0, 1.6 * scale, -1.0 * scale); 
             group.add(cab); 
 
             // Windows 
             const sideWindow = new THREE.Mesh(new THREE.BoxGeometry(1.45 * scale, 0.6 * scale, 0.8 * scale), windowMat); 
             sideWindow.position.set(0, 1.8 * scale, -1.0 * scale); 
             group.add(sideWindow); 
 
             const frontWindow = new THREE.Mesh(new THREE.BoxGeometry(1.0 * scale, 0.5 * scale, 0.1 * scale), windowMat); 
             frontWindow.position.set(0, 1.8 * scale, -0.35 * scale); 
             group.add(frontWindow); 
 
             // Roof 
             const roof = new THREE.Mesh(new THREE.BoxGeometry(1.6 * scale, 0.2 * scale, 1.6 * scale), blackMat); 
             roof.position.set(0, 2.5 * scale, -1.0 * scale); 
             group.add(roof); 
 
             // Chimney 
             const chimneyBase = new THREE.Mesh(new THREE.CylinderGeometry(0.2 * scale, 0.2 * scale, 0.6 * scale, 12), blackMat); 
             chimneyBase.position.set(0, 1.8 * scale, 1.2 * scale); 
             group.add(chimneyBase); 
             
             const chimneyTop = new THREE.Mesh(new THREE.ConeGeometry(0.4 * scale, 0.4 * scale, 12, 1, true), blackMat); 
             chimneyTop.rotation.x = Math.PI; 
             chimneyTop.position.set(0, 2.2 * scale, 1.2 * scale); 
             group.add(chimneyTop); 
 
             // Cowcatcher 
             const cowcatcher = new THREE.Mesh(new THREE.ConeGeometry(0.6 * scale, 0.6 * scale, 4), redMat); 
             cowcatcher.rotation.x = -Math.PI / 4; 
             cowcatcher.rotation.y = Math.PI / 4; 
             cowcatcher.position.set(0, 0.5 * scale, 2.0 * scale); 
             cowcatcher.scale.set(1.5, 1, 0.5); 
             group.add(cowcatcher); 
 
             // Dome 
             const dome = new THREE.Mesh(new THREE.SphereGeometry(0.3 * scale, 12, 12, 0, Math.PI * 2, 0, Math.PI / 2), goldMat); 
             dome.position.set(0, 1.7 * scale, 0.2 * scale); 
             group.add(dome); 
 
             // Headlight 
             const headlight = new THREE.Mesh(new THREE.CylinderGeometry(0.15 * scale, 0.15 * scale, 0.2 * scale, 12), goldMat); 
             headlight.rotation.x = Math.PI / 2; 
             headlight.position.set(0, 1.1 * scale, 1.65 * scale); 
             group.add(headlight); 
 
             // Wheels 
             const wheelGeo = new THREE.CylinderGeometry(0.45 * scale, 0.45 * scale, 0.2 * scale, 16); 
             const wheelMat = new THREE.MeshStandardMaterial({ color: 0xe11d48 }); 
 
             [0.2, -0.8, -1.8].forEach(z => { 
                 const wL = new THREE.Mesh(wheelGeo, wheelMat); 
                 wL.rotation.z = Math.PI / 2; 
                 wL.position.set(0.6 * scale, 0.45 * scale, z * scale); 
                 group.add(wL); 
                 const wR = wL.clone(); 
                 wR.position.x = -0.6 * scale; 
                 group.add(wR); 
                 
                 const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.1 * scale, 0.1 * scale, 0.3 * scale), goldMat); 
                 hub.rotation.z = Math.PI / 2; 
                 hub.position.copy(wL.position); 
                 group.add(hub); 
                 const hubR = hub.clone(); 
                 hubR.position.copy(wR.position); 
                 group.add(hubR); 
             }); 
 
             const smallWheelGeo = new THREE.CylinderGeometry(0.25 * scale, 0.25 * scale, 0.2 * scale, 16); 
             [1.4].forEach(z => { 
                 const wL = new THREE.Mesh(smallWheelGeo, blackMat); 
                 wL.rotation.z = Math.PI / 2; 
                 wL.position.set(0.6 * scale, 0.25 * scale, z * scale); 
                 group.add(wL); 
                 const wR = wL.clone(); 
                 wR.position.x = -0.6 * scale; 
                 group.add(wR); 
             }); 
 
             return group; 
         } 
 
         function createDetailedWagon(type, color) { 
             const group = new THREE.Group(); 
             const scale = 1.5; 
             
             const chassisMat = new THREE.MeshStandardMaterial({ color: 0x334155 }); 
             const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.3 * scale, 0.2 * scale, 3.0 * scale), chassisMat); 
             chassis.position.y = 0.3 * scale; 
             group.add(chassis); 
 
             const bodyMat = new THREE.MeshStandardMaterial({ color: color, roughness: 0.3, metalness: 0.2 }); 
 
             if (type === "tanker") { 
                 const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.65 * scale, 0.65 * scale, 2.6 * scale, 24), bodyMat); 
                 tank.rotation.x = Math.PI / 2; 
                 tank.position.y = 1.0 * scale; 
                 group.add(tank); 
                 
                 const bandMat = new THREE.MeshStandardMaterial({ color: 0xffffff }); 
                 [-0.8, 0.8].forEach(z => { 
                     const band = new THREE.Mesh(new THREE.TorusGeometry(0.66 * scale, 0.05 * scale, 8, 24), bandMat); 
                     band.position.set(0, 1.0 * scale, z * scale); 
                     group.add(band); 
                 }); 
 
             } else if (type === "boxcar") { 
                 const box = new THREE.Mesh(new THREE.BoxGeometry(1.4 * scale, 1.4 * scale, 2.8 * scale), bodyMat); 
                 box.position.y = 1.1 * scale; 
                 group.add(box); 
                 
                 const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.8 * scale, 0.8 * scale, 2.9 * scale, 4, 1, false, Math.PI * 0.25), bodyMat); 
                 roof.rotation.z = Math.PI / 2; 
                 roof.rotation.y = Math.PI / 2; 
                 roof.position.y = 1.8 * scale; 
                 roof.scale.set(1, 0.5, 1); 
                 group.add(roof); 
 
                 const door = new THREE.Mesh(new THREE.BoxGeometry(1.45 * scale, 1.0 * scale, 0.8 * scale), new THREE.MeshStandardMaterial({color: 0x1e293b})); 
                 door.position.y = 1.1 * scale; 
                 group.add(door); 
 
             } else if (type === "hopper") { 
                 const hopper = new THREE.Mesh(new THREE.BoxGeometry(1.4 * scale, 1.0 * scale, 2.8 * scale), bodyMat); 
                 hopper.position.y = 0.9 * scale; 
                 group.add(hopper); 
                 
                 const coalGeo = new THREE.Group(); 
                 for(let i=0; i<8; i++) { 
                     const lump = new THREE.Mesh(new THREE.DodecahedronGeometry(0.3 * scale), new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 })); 
                     lump.position.set((Math.random() - 0.5) * scale, 0, (Math.random() * 2.0 - 1.0) * scale); 
                     coalGeo.add(lump); 
                 } 
                 coalGeo.position.y = 1.4 * scale; 
                 group.add(coalGeo); 
 
             } else if (type === "car_carrier") { 
                 const bed = new THREE.Mesh(new THREE.BoxGeometry(1.4 * scale, 0.2 * scale, 2.8 * scale), bodyMat); 
                 bed.position.y = 0.5 * scale; 
                 group.add(bed); 
                 
                 const carColors = [0xfacc15, 0x3b82f6, 0xef4444]; 
                 [-0.8, 0.8].forEach((z, i) => { 
                     const carGroup = new THREE.Group(); 
                     const cColor = carColors[i % carColors.length]; 
                     const cMat = new THREE.MeshStandardMaterial({ color: cColor, roughness: 0.2 }); 
                     
                     const cBody = new THREE.Mesh(new THREE.BoxGeometry(0.6 * scale, 0.3 * scale, 1.0 * scale), cMat); 
                     cBody.position.y = 0.25 * scale; 
                     carGroup.add(cBody); 
                     
                     const cCab = new THREE.Mesh(new THREE.BoxGeometry(0.5 * scale, 0.25 * scale, 0.5 * scale), new THREE.MeshStandardMaterial({ color: 0xbae6fd })); 
                     cCab.position.y = 0.5 * scale; 
                     carGroup.add(cCab); 
                     
                     const cwGeo = new THREE.CylinderGeometry(0.1 * scale, 0.1 * scale, 0.1 * scale, 8); 
                     const cwMat = new THREE.MeshStandardMaterial({ color: 0x111111 }); 
                     [0.25, -0.25].forEach(cz => { 
                         [0.3, -0.3].forEach(cx => { 
                             const cw = new THREE.Mesh(cwGeo, cwMat); 
                             cw.rotation.z = Math.PI / 2; 
                             cw.position.set(cx * scale, 0.1 * scale, cz * scale); 
                             carGroup.add(cw); 
                         }); 
                     }); 
 
                     carGroup.position.set(0, 0.6 * scale, z * scale); 
                     if (Math.random() > 0.5) carGroup.rotation.y = Math.PI; 
                     group.add(carGroup); 
                 }); 
 
             } else { 
                 // Flatbed with logs 
                 const bed = new THREE.Mesh(new THREE.BoxGeometry(1.4 * scale, 0.2 * scale, 2.8 * scale), bodyMat); 
                 bed.position.y = 0.5 * scale; 
                 group.add(bed); 
                 
                 const logMat = new THREE.MeshStandardMaterial({ color: 0x78350f }); 
                 [0.3, 0.6, 0.9].forEach((y, i) => { 
                     const count = i === 2 ? 1 : 2; 
                     for(let j=0; j<count; j++) { 
                         const log = new THREE.Mesh(new THREE.CylinderGeometry(0.15 * scale, 0.15 * scale, 2.6 * scale, 8), logMat); 
                         log.rotation.x = Math.PI / 2; 
                         const xOff = count === 1 ? 0 : (j === 0 ? -0.2 : 0.2) * scale; 
                         log.position.set(xOff, (0.5 + y) * scale, 0); 
                         group.add(log); 
                     } 
                 }); 
                 
                 const stakeGeo = new THREE.BoxGeometry(0.1 * scale, 0.8 * scale, 0.1 * scale); 
                 [1.2, 0, -1.2].forEach(z => { 
                     [-0.6, 0.6].forEach(x => { 
                         const stake = new THREE.Mesh(stakeGeo, bodyMat); 
                         stake.position.set(x * scale, 0.8 * scale, z * scale); 
                         group.add(stake); 
                     }); 
                 }); 
             } 
 
             // Wheels 
             const wheelGeo = new THREE.CylinderGeometry(0.3 * scale, 0.3 * scale, 0.2 * scale, 16); 
             const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111 }); 
             [[-0.65, 0.3, 1.0], [0.65, 0.3, 1.0], [-0.65, 0.3, -1.0], [0.65, 0.3, -1.0]].forEach(p => { 
                 const w = new THREE.Mesh(wheelGeo, wheelMat); 
                 w.rotation.z = Math.PI / 2; 
                 w.position.set(p[0] * scale, p[1] * scale, p[2] * scale); 
                 group.add(w); 
             }); 
 
             // Couplers 
             const coupler = new THREE.Mesh(new THREE.BoxGeometry(0.2 * scale, 0.1 * scale, 0.4 * scale), new THREE.MeshStandardMaterial({color: 0x000000})); 
             coupler.position.set(0, 0.3 * scale, 1.6 * scale); 
             group.add(coupler); 
             const coupler2 = coupler.clone(); 
             coupler2.position.z = -1.6 * scale; 
             group.add(coupler2); 
 
             return group; 
         } 
 
         function createTree() { 
             const group = new THREE.Group(); 
             const scale = 0.8 + Math.random() * 0.85; 
             
             const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2 * scale, 0.25 * scale, 1.5 * scale, 8), new THREE.MeshStandardMaterial({ color: 0x8b5a2b })); 
             trunk.position.y = 0.75 * scale; 
             group.add(trunk); 
             
             const foliage = new THREE.Mesh(new THREE.SphereGeometry(1.0 * scale, 16, 16), new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.8 })); 
             foliage.position.y = 2.0 * scale; 
             group.add(foliage); 
             
             return group; 
         } 
 
         function createPineTree() { 
             const group = new THREE.Group(); 
             const scale = 0.8 + Math.random() * 0.85; 
 
             const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.15 * scale, 0.2 * scale, 1.0 * scale, 8), new THREE.MeshStandardMaterial({ color: 0x5d4037 })); 
             trunk.position.y = 0.5 * scale; 
             group.add(trunk); 
 
             const foliageMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.8 }); 
             
             const bottom = new THREE.Mesh(new THREE.ConeGeometry(1.2 * scale, 1.5 * scale, 8), foliageMat); 
             bottom.position.y = 1.5 * scale; 
             group.add(bottom); 
 
             const middle = new THREE.Mesh(new THREE.ConeGeometry(1.0 * scale, 1.2 * scale, 8), foliageMat); 
             middle.position.y = 2.2 * scale; 
             group.add(middle); 
 
             const top = new THREE.Mesh(new THREE.ConeGeometry(0.7 * scale, 1.0 * scale, 8), foliageMat); 
             top.position.y = 2.9 * scale; 
             group.add(top); 
 
             return group; 
         } 
 
         // --- World Generation --- 
         const trackCount = 40; 
         const trackSpacing = 7; 
         const trackLength = 500; 
         const trainData = []; 
 
         for (let i = 0; i < trackCount; i++) { 
             const x = (i - trackCount / 2) * trackSpacing; 
             const direction = i % 2 === 0 ? 1 : -1; 
             const speed = 0.1 + Math.random() * 0.3; 
 
             // Train 
             const trainGroup = new THREE.Group(); 
             const loco = createLocomotive(0x10b981); 
             if (direction === -1) loco.rotation.y = Math.PI; 
             trainGroup.add(loco); 
 
             const wagonCount = 3 + Math.floor(Math.random() * 4); 
             for (let w = 0; w < wagonCount; w++) { 
                 const types = ["tanker", "boxcar", "hopper", "flatbed", "car_carrier"]; 
                 const type = types[Math.floor(Math.random() * types.length)]; 
                 const colors = [0xef4444, 0x0fa47a, 0xf59e0b, 0x3b82f6, 0x8b5cf6]; 
                 const color = colors[Math.floor(Math.random() * colors.length)]; 
                 const wagon = createDetailedWagon(type, color); 
                 const offset = (w + 1) * 6.0; 
                 wagon.position.z = direction === 1 ? -offset : offset; 
                 if (direction === -1) wagon.rotation.y = Math.PI; 
                 trainGroup.add(wagon); 
             } 
 
             trainGroup.position.set(x, 0, (Math.random() - 0.5) * trackLength); 
             scene.add(trainGroup); 
             trainData.push({ mesh: trainGroup, speed, direction }); 
 
             // Rails 
             const railMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.5, roughness: 0.4 }); 
             const r1 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, trackLength), railMat); 
             r1.position.set(x - 0.8, 0.05, 0); 
             scene.add(r1); 
             const r2 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, trackLength), railMat); 
             r2.position.set(x + 0.8, 0.05, 0); 
             scene.add(r2); 
 
             // Sleepers 
             const sleeperGeo = new THREE.BoxGeometry(2.2, 0.08, 0.4); 
             const sleeperMat = new THREE.MeshStandardMaterial({ color: 0x9ca3af }); 
             for (let z = -trackLength / 2; z < trackLength / 2; z += 1.25) { 
                 const sleeper = new THREE.Mesh(sleeperGeo, sleeperMat); 
                 sleeper.position.set(x, 0.04, z); 
                 scene.add(sleeper); 
             } 
 
             // Trees 
             if (i < trackCount - 1) { 
                 const treeCount = Math.floor(Math.random() * 48); 
                 for(let t=0; t<treeCount; t++) { 
                     const isPine = Math.random() > 0.5; 
                     const tree = isPine ? createPineTree() : createTree(); 
                     
                     const gapCenter = x + trackSpacing / 2; 
                     const zPos = (Math.random() - 0.5) * trackLength; 
                     const xPos = gapCenter + (Math.random() - 0.5) * 1.5; 
                     
                     tree.position.set(xPos, 0, zPos); 
                     tree.rotation.y = Math.random() * Math.PI * 2; 
                     scene.add(tree); 
                 } 
             } 
         } 
 
         // --- Animation --- 
         function animate() { 
             requestAnimationFrame(animate); 
             trainData.forEach((data) => { 
                 data.mesh.position.z += data.speed * data.direction; 
                 if (data.direction === 1 && data.mesh.position.z > trackLength / 2 + 50) 
                     data.mesh.position.z = -trackLength / 2 - 50; 
                 if (data.direction === -1 && data.mesh.position.z < -trackLength / 2 - 50) 
                     data.mesh.position.z = trackLength / 2 + 50; 
             }); 
             camera.position.x -= 0.0005; 
             camera.position.z -= 0.0005; 
             renderer.render(scene, camera); 
         } 
         animate(); 
 
         // --- Resize --- 
         window.addEventListener("resize", () => { 
             const aspect = window.innerWidth / window.innerHeight; 
             camera.left = -d * aspect; 
             camera.right = d * aspect; 
             camera.updateProjectionMatrix(); 
             renderer.setSize(window.innerWidth, window.innerHeight); 
         });