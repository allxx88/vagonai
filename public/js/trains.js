import * as THREE from "three";

const threeContainer = document.getElementById("three-container");

if (threeContainer) {
    // --- Three.js Scene ---
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf7fafc);
    scene.fog = new THREE.Fog(0xf0f4f8, 20, 140);

    const aspect = window.innerWidth / window.innerHeight;
    const d = 14;
    const camera = new THREE.OrthographicCamera(
        -d * aspect,
        d * aspect,
        d,
        -d,
        1,
        1000,
    );
    camera.position.set(50, 50, 50);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    threeContainer.appendChild(renderer.domElement);

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0xdddddd, 1.2);
    scene.add(hemiLight);
    const dirLight = new THREE.DirectionalLight(0xffffff, 2.0);
    dirLight.position.set(20, 40, 20);
    dirLight.castShadow = true;
    scene.add(dirLight);

    const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(2000, 2000),
        new THREE.MeshStandardMaterial({ color: 0xe5e7eb }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // --- Detailed Models ---
    function createLocomotive(color) {
        const group = new THREE.Group();
        const scale = 1.3;
        
        // Chassis
        const chassisGeo = new THREE.BoxGeometry(1.4 * scale, 0.4 * scale, 4.5 * scale);
        const chassisMat = new THREE.MeshStandardMaterial({ color: 0x1e293b });
        const chassis = new THREE.Mesh(chassisGeo, chassisMat);
        chassis.position.y = 0.4 * scale;
        group.add(chassis);

        // Main Body
        const bodyGeo = new THREE.BoxGeometry(1.6 * scale, 1.4 * scale, 3 * scale);
        const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.3, metalness: 0.4 });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.set(0, 1.3 * scale, -0.5 * scale);
        group.add(body);

        // Cab
        const cabGeo = new THREE.BoxGeometry(1.6 * scale, 1.8 * scale, 1.2 * scale);
        const cab = new THREE.Mesh(cabGeo, bodyMat);
        cab.position.set(0, 1.5 * scale, 1.4 * scale);
        group.add(cab);

        // Handrails (Detail)
        const railGeo = new THREE.CylinderGeometry(0.05 * scale, 0.05 * scale, 3 * scale, 8);
        const railMat = new THREE.MeshStandardMaterial({ color: 0x334155 });
        const railL = new THREE.Mesh(railGeo, railMat);
        railL.rotation.x = Math.PI / 2;
        railL.position.set(0.75 * scale, 0.8 * scale, -0.5 * scale);
        group.add(railL);
        const railR = railL.clone();
        railR.position.x = -0.75 * scale;
        group.add(railR);

        // Chimney
        const chimneyGeo = new THREE.CylinderGeometry(0.25 * scale, 0.25 * scale, 0.8 * scale, 12);
        const chimney = new THREE.Mesh(chimneyGeo, new THREE.MeshStandardMaterial({ color: 0x334155 }));
        chimney.position.set(0, 2.2 * scale, -1.2 * scale);
        group.add(chimney);

        // Windows
        const winMat = new THREE.MeshStandardMaterial({
            color: 0xbae6fd,
            emissive: 0xbae6fd,
            emissiveIntensity: 1.0,
        });
        const win1 = new THREE.Mesh(new THREE.PlaneGeometry(0.5 * scale, 0.5 * scale), winMat);
        win1.position.set(0.81 * scale, 1.8 * scale, 1.4 * scale);
        win1.rotation.y = Math.PI / 2;
        group.add(win1);
        const win2 = new THREE.Mesh(new THREE.PlaneGeometry(0.5 * scale, 0.5 * scale), winMat);
        win2.position.set(-0.81 * scale, 1.8 * scale, 1.4 * scale);
        win2.rotation.y = -Math.PI / 2;
        group.add(win2);

        const winFront = new THREE.Mesh(new THREE.PlaneGeometry(1.2 * scale, 0.6 * scale), winMat);
        winFront.position.set(0, 1.8 * scale, 2.01 * scale);
        group.add(winFront);

        // Headlights
        const lightGeo = new THREE.CylinderGeometry(0.15 * scale, 0.15 * scale, 0.1 * scale, 12);
        const lightMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 2 });
        const light1 = new THREE.Mesh(lightGeo, lightMat);
        light1.rotation.x = Math.PI / 2;
        light1.position.set(0.5 * scale, 1.0 * scale, 2.01 * scale);
        group.add(light1);
        const light2 = new THREE.Mesh(lightGeo, lightMat);
        light2.rotation.x = Math.PI / 2;
        light2.position.set(-0.5 * scale, 1.0 * scale, 2.01 * scale);
        group.add(light2);

        // Top Marker Lights (Detail)
        const markerGeo = new THREE.SphereGeometry(0.08 * scale, 8, 8);
        const markerMat = new THREE.MeshStandardMaterial({ color: 0xff4444, emissive: 0xff4444, emissiveIntensity: 1 });
        const m1 = new THREE.Mesh(markerGeo, markerMat);
        m1.position.set(0.6 * scale, 2.4 * scale, 1.9 * scale);
        group.add(m1);
        const m2 = m1.clone();
        m2.position.x = -0.6 * scale;
        group.add(m2);

        // Wheels
        const wheelGeo = new THREE.CylinderGeometry(0.4 * scale, 0.4 * scale, 0.2 * scale, 16);
        const wheelMat = new THREE.MeshStandardMaterial({ color: 0x0f172a });
        [[-0.85, 0.5, 1.5], [0.85, 0.5, 1.5], [-0.85, 0.5, 0], [0.85, 0.5, 0], [-0.85, 0.5, -1.5], [0.85, 0.5, -1.5]].forEach((p) => {
            const w = new THREE.Mesh(wheelGeo, wheelMat);
            w.rotation.z = Math.PI / 2;
            w.position.set(p[0] * scale, p[1] * scale, p[2] * scale);
            group.add(w);
        });
        return group;
    }

    function createCar(color) {
        const car = new THREE.Group();
        const scale = 1.3;
        const body = new THREE.Mesh(
            new THREE.BoxGeometry(0.8 * scale, 0.4 * scale, 1.8 * scale),
            new THREE.MeshStandardMaterial({ color, roughness: 0.3, metalness: 0.5 })
        );
        body.position.y = 0.21 * scale;
        car.add(body);
        const top = new THREE.Mesh(
            new THREE.BoxGeometry(0.7 * scale, 0.35 * scale, 0.9 * scale),
            new THREE.MeshStandardMaterial({ color })
        );
        top.position.set(0, 0.56 * scale, -0.1 * scale);
        car.add(top);
        const wheelGeo = new THREE.CylinderGeometry(0.15 * scale, 0.15 * scale, 0.1 * scale, 12);
        const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
        [[-0.42, 0.16, 0.6], [0.42, 0.16, 0.6], [-0.42, 0.16, -0.6], [0.42, 0.16, -0.6]].forEach((pos) => {
            const wheel = new THREE.Mesh(wheelGeo, wheelMat);
            wheel.rotation.z = Math.PI / 2;
            wheel.position.set(pos[0] * scale, pos[1] * scale, pos[2] * scale);
            car.add(wheel);
        });
        return car;
    }

    function createDetailedWagon(type, color) {
        const group = new THREE.Group();
        const scale = 1.3;
        const chassisMat = new THREE.MeshStandardMaterial({ color: 0x1e293b });
        const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.3 * scale, 0.3 * scale, 4 * scale), chassisMat);
        chassis.position.y = 0.4 * scale;
        group.add(chassis);
        const sill = new THREE.Mesh(new THREE.BoxGeometry(0.1 * scale, 0.2 * scale, 4.2 * scale), chassisMat);
        sill.position.set(0.8 * scale, 0.55 * scale, 0);
        group.add(sill);
        const sill2 = sill.clone();
        sill2.position.x = -0.8 * scale;
        group.add(sill2);

        const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.2 });

        if (type === "tanker") {
            const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.75 * scale, 0.75 * scale, 3.6 * scale, 24), bodyMat);
            tank.rotation.x = Math.PI / 2;
            tank.position.y = 1.15 * scale;
            group.add(tank);
            const dome = new THREE.Mesh(new THREE.CylinderGeometry(0.4 * scale, 0.4 * scale, 0.2 * scale, 16), bodyMat);
            dome.position.y = 1.95 * scale;
            group.add(dome);
            const ladder = new THREE.Mesh(new THREE.BoxGeometry(0.1 * scale, 1.2 * scale, 0.4 * scale), chassisMat);
            ladder.position.set(0.7 * scale, 1.2 * scale, 0);
            group.add(ladder);
            for (let z = -1.6 * scale; z <= 1.6 * scale; z += 0.8 * scale) {
                const band = new THREE.Mesh(new THREE.TorusGeometry(0.75 * scale, 0.04 * scale, 6, 24), new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.6, roughness: 0.4 }));
                band.position.z = z;
                group.add(band);
            }
            const endCap1 = new THREE.Mesh(new THREE.SphereGeometry(0.75 * scale, 16, 12), bodyMat);
            endCap1.position.z = 1.8 * scale;
            group.add(endCap1);
            const endCap2 = endCap1.clone();
            endCap2.position.z = -1.8 * scale;
            group.add(endCap2);
            const walkway = new THREE.Mesh(new THREE.BoxGeometry(0.3 * scale, 0.05 * scale, 3.6 * scale), new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.4, roughness: 0.6 }));
            walkway.position.y = 1.6 * scale;
            group.add(walkway);
        } else if (type === "boxcar") {
            const box = new THREE.Mesh(new THREE.BoxGeometry(1.6 * scale, 1.5 * scale, 3.8 * scale), bodyMat);
            box.position.y = 1.3 * scale;
            group.add(box);
            const door = new THREE.Mesh(new THREE.BoxGeometry(0.1 * scale, 1.3 * scale, 1.2 * scale), new THREE.MeshStandardMaterial({ color: 0x334155 }));
            door.position.set(0.8 * scale, 1.3 * scale, 0);
            group.add(door);
            for (let z = -1.6 * scale; z <= 1.6 * scale; z += 0.4 * scale) {
                const ribL = new THREE.Mesh(new THREE.BoxGeometry(0.05 * scale, 1.4 * scale, 0.05 * scale), new THREE.MeshStandardMaterial({ color: 0x111827 }));
                ribL.position.set(0.82 * scale, 1.3 * scale, z);
                group.add(ribL);
                const ribR = ribL.clone();
                ribR.position.x = -0.82 * scale;
                group.add(ribR);
            }
            const roofMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.6, metalness: 0.2 });
            const roof = new THREE.Mesh(new THREE.BoxGeometry(1.66 * scale, 0.18 * scale, 3.86 * scale), roofMat);
            roof.position.y = 2.12 * scale;
            group.add(roof);
            const eaveL = new THREE.Mesh(new THREE.BoxGeometry(0.06 * scale, 0.12 * scale, 3.86 * scale), roofMat);
            eaveL.position.set(0.86 * scale, 2.12 * scale, 0);
            group.add(eaveL);
            const eaveR = eaveL.clone();
            eaveR.position.x = -0.86 * scale;
            group.add(eaveR);
            for (let z = -1.6 * scale; z <= 1.6 * scale; z += 0.6 * scale) {
                const seam = new THREE.Mesh(new THREE.BoxGeometry(1.7 * scale, 0.02 * scale, 0.04 * scale), new THREE.MeshStandardMaterial({ color: 0x94a3b8 }));
                seam.position.set(0, 2.2 * scale, z);
                group.add(seam);
            }
        } else if (type === "platform") {
            const car1 = createCar(0xef4444);
            car1.position.set(0, 0.55 * scale, 0.8 * scale);
            group.add(car1);
            const car2 = createCar(0x3b82f6);
            car2.position.set(0, 0.55 * scale, -0.8 * scale);
            group.add(car2);
        } else if (type === "dumpcar") {
            const dump = new THREE.Mesh(new THREE.BoxGeometry(1.6 * scale, 0.8 * scale, 3.8 * scale), bodyMat);
            dump.position.y = 0.95 * scale;
            dump.rotation.z = 0.1;
            group.add(dump);
            const cylMat = new THREE.MeshStandardMaterial({ color: 0x6b7280, metalness: 0.7, roughness: 0.3 });
            const piston1 = new THREE.Mesh(new THREE.CylinderGeometry(0.06 * scale, 0.06 * scale, 1.0 * scale, 10), cylMat);
            piston1.rotation.z = -0.6;
            piston1.position.set(0.3 * scale, 0.7 * scale, 1.4 * scale);
            group.add(piston1);
            const piston2 = piston1.clone();
            piston2.position.z = -1.4 * scale;
            group.add(piston2);
        } else {
            const hopper = new THREE.Mesh(new THREE.BoxGeometry(1.6 * scale, 1.2 * scale, 3.8 * scale), bodyMat);
            hopper.position.y = 1.15 * scale;
            group.add(hopper);
            for (let i = -1.5; i <= 1.5; i += 0.5) {
                const rib = new THREE.Mesh(new THREE.BoxGeometry(0.1 * scale, 1.2 * scale, 0.1 * scale), new THREE.MeshStandardMaterial({ color: 0x1e293b }));
                rib.position.set(0.8 * scale, 1.15 * scale, i * scale);
                group.add(rib);
                const rib2 = rib.clone();
                rib2.position.set(-0.8 * scale, 1.15 * scale, i * scale);
                group.add(rib2);
            }
            for (let z = -1.2 * scale; z <= 1.2 * scale; z += 1.2 * scale) {
                const chute = new THREE.Mesh(new THREE.ConeGeometry(0.35 * scale, 0.6 * scale, 12), new THREE.MeshStandardMaterial({ color: 0x334155 }));
                chute.position.set(0, 0.6 * scale, z);
                chute.rotation.x = Math.PI;
                group.add(chute);
            }
            const hatchMat = new THREE.MeshStandardMaterial({ color: 0x9ca3af });
            for (let z = -1.2 * scale; z <= 1.2 * scale; z += 0.6 * scale) {
                const hatch = new THREE.Mesh(new THREE.BoxGeometry(0.5 * scale, 0.04 * scale, 0.3 * scale), hatchMat);
                hatch.position.set(0, 1.8 * scale, z);
                group.add(hatch);
            }
        }

        const couplerGeo = new THREE.BoxGeometry(0.3 * scale, 0.3 * scale, 0.5 * scale);
        const coupler = new THREE.Mesh(couplerGeo, chassisMat);
        coupler.position.set(0, 0.4 * scale, 2.2 * scale);
        group.add(coupler);
        const coupler2 = coupler.clone();
        coupler2.position.z = -2.2 * scale;
        group.add(coupler2);
        const bufferMat = new THREE.MeshStandardMaterial({ color: 0x111827, metalness: 0.7, roughness: 0.3 });
        const bufferGeo = new THREE.CylinderGeometry(0.12 * scale, 0.12 * scale, 0.2 * scale, 12);
        const bf1 = new THREE.Mesh(bufferGeo, bufferMat);
        bf1.rotation.x = Math.PI / 2;
        bf1.position.set(0.5 * scale, 0.5 * scale, 2.3 * scale);
        group.add(bf1);
        const bf2 = bf1.clone();
        bf2.position.x = -0.5 * scale;
        group.add(bf2);
        const bf3 = bf1.clone();
        bf3.position.z = -2.3 * scale;
        group.add(bf3);
        const bf4 = bf2.clone();
        bf4.position.z = -2.3 * scale;
        group.add(bf4);

        const wheelGeo = new THREE.CylinderGeometry(0.35 * scale, 0.35 * scale, 0.2 * scale, 16);
        const wheelMat = new THREE.MeshStandardMaterial({ color: 0x0f172a });
        [[-0.8, 0.45, 1.4], [0.8, 0.45, 1.4], [-0.8, 0.45, -1.4], [0.8, 0.45, -1.4]].forEach((p) => {
            const w = new THREE.Mesh(wheelGeo, wheelMat);
            w.rotation.z = Math.PI / 2;
            w.position.set(p[0] * scale, p[1] * scale, p[2] * scale);
            group.add(w);
        });
        const axleMat = new THREE.MeshStandardMaterial({ color: 0x4b5563, metalness: 0.8, roughness: 0.2 });
        [1.4 * scale, -1.4 * scale].forEach((zv) => {
            const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.06 * scale, 0.06 * scale, 1.6 * scale, 10), axleMat);
            axle.rotation.z = Math.PI / 2;
            axle.position.set(0, 0.45 * scale, zv);
            group.add(axle);
            const springL = new THREE.Mesh(new THREE.TorusGeometry(0.12 * scale, 0.03 * scale, 6, 12), axleMat);
            springL.position.set(0.4 * scale, 0.6 * scale, zv);
            group.add(springL);
            const springR = springL.clone();
            springR.position.x = -0.4 * scale;
            group.add(springR);
        });
        return group;
    }

    const trackCount = 40;
    const trackSpacing = 7; // Increased spacing for larger trains
    const trackLength = 500;
    const trainData = [];

    for (let i = 0; i < trackCount; i++) {
        const x = (i - trackCount / 2) * trackSpacing;
        const direction = i % 2 === 0 ? 1 : -1;
        const speed = 0.2 + Math.random() * 0.8;

        const trainGroup = new THREE.Group();
        const loco = createLocomotive(0x10b981);
        if (direction === -1) loco.rotation.y = Math.PI;
        trainGroup.add(loco);

        const wagonCount = 3 + Math.floor(Math.random() * 4);
        for (let w = 0; w < wagonCount; w++) {
            const types = ["tanker", "boxcar", "hopper", "platform", "dumpcar"];
            const type = types[Math.floor(Math.random() * types.length)];
            const colors = [0xef4444, 0x0FA47A, 0xf59e0b, 0x60a5fa];
            const color = colors[Math.floor(Math.random() * colors.length)];
            const wagon = createDetailedWagon(type, color);
            const offset = (w + 1) * 5.5; // Increased offset for longer wagons
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
        const sleeperMat = new THREE.MeshStandardMaterial({ color: 0x6b7280 });
        for (let z = -trackLength / 2; z < trackLength / 2; z += 1.25) {
            const sleeper = new THREE.Mesh(sleeperGeo, sleeperMat);
            sleeper.position.set(x, 0.04, z);
            scene.add(sleeper);
        }
    }

    function animate() {
        requestAnimationFrame(animate);
        trainData.forEach((data) => {
            data.mesh.position.z += data.speed * data.direction;
            if (
                data.direction === 1 &&
                data.mesh.position.z > trackLength / 2 + 50
            )
                data.mesh.position.z = -trackLength / 2 - 50;
            if (
                data.direction === -1 &&
                data.mesh.position.z < -trackLength / 2 - 50
            )
                data.mesh.position.z = trackLength / 2 + 50;
        });
        camera.position.x -= 0.0005;
        camera.position.z -= 0.0005;
        renderer.render(scene, camera);
    }
    animate();

    window.onresize = () => {
        const aspect = window.innerWidth / window.innerHeight;
        camera.left = -d * aspect;
        camera.right = d * aspect;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    };
}
