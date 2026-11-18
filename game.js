(() => {
  const canvas = document.getElementById('world');
  const ctx = canvas.getContext('2d');
  const mapCanvas = document.getElementById('mapCanvas');
  const mapCtx = mapCanvas.getContext('2d');
  const $ = (id) => document.getElementById(id);
  const W = 1800, H = 1280;
  const plotDefs = [
    { x: 620, y: 432, w: 148, h: 108, label: 'NORTH PLOT' },
    { x: 810, y: 490, w: 148, h: 108, label: 'SOUTH PLOT' }
  ];
  const shop = { x: 1224, y: 515, name: 'Village shop' };
  const mandi = { x: 1390, y: 590, name: 'Mandi point' };
  const farmSign = { x: 450, y: 622, name: 'Farm noticeboard' };
  const home = { x: 302, y: 457, name: 'Farmhouse' };
  const player = { x: 435, y: 520, vx: 0, vy: 0, dirX: 1, dirY: 0, speed: 205, running: false };
  const state = {
    money: 1250, seeds: 0, produce: 0, day: 1, timeMinutes: 8 * 60 + 24,
    plots: [{ ploughed: false, crop: '', stage: 0, growth: 0 }, { ploughed: true, crop: '', stage: 0, growth: 0 }],
    missionStage: 0, harvested: false, sold: false, interaction: null,
    language: 'EN', sound: true, paused: false, toastTimer: 0, dirty: false,
    keys: Object.create(null), joyX: 0, joyY: 0, runTouch: false, modal: null,
    questComplete: false, inventoryOpen: false
  };
  const saved = localStorage.getItem('raasta6-save-v1');
  if (saved) {
    try {
      const s = JSON.parse(saved);
      if (s && s.version === 1) {
        Object.assign(state, s.state);
        Object.assign(player, s.player);
      }
    } catch (_) { /* ignore invalid local save */ }
  }

  const strings = {
    EN: {
      missionTitle: ['A little groundwork', 'Make the rounds', 'Ready for market', 'A good first harvest'],
      missionDesc: [
        'Get the farm ready for its first sowing. Pick up a seed packet in the village.',
        'The soil is waiting. Plough a plot, then sow your mustard seeds.',
        'Give the crop a little time. Rest through two days, then bring the harvest to the mandi.',
        'A good start for the farm. Take your earnings and see what the village needs next.'
      ],
      objectives: ['Village shop · 118 m', 'Farm plots · 42 m', 'Farm plots · wait for harvest', 'Mandi point · 94 m'],
      actions: ['Talk to shopkeeper', 'Work this plot', 'Sell your produce', 'Look around'],
      progress: ['0 / 3', '1 / 3', '2 / 3', '3 / 3'],
      taskLabels: ['CURRENT TASK', 'CURRENT TASK', 'CURRENT TASK', 'TASK COMPLETE'],
      locations: ['Kheda · Family farm', 'Kheda · Village shop', 'Kheda · Mandi yard'],
      tip: 'The shopkeeper has seed packets on the counter.',
      notReady: 'The field needs to be ploughed first.',
      needSeed: 'Pick up a seed packet from the village shop.',
      planted: 'Mustard sown. Give it time to grow.',
      growing: 'The crop is coming along. Rest until it is ready.',
      ripe: 'The mustard is ready. Harvest it while the weather holds.',
      harvest: 'Harvest collected. Take it to the mandi to sell.',
      sold: 'Produce sold. The family farm is back on its feet.',
      shopBuy: 'Seed packet added to your bag.',
      wait: 'You rested through the night. A new day begins.',
      noProduce: 'Nothing to sell just yet. Check the farm plots.',
      done: 'You completed the first farm cycle!',
      save: 'GAME SAVED'
    },
    HI: {
      missionTitle: ['खेत की तैयारी', 'गाँव का चक्कर', 'मंडी के लिए तैयार', 'पहली अच्छी फसल'],
      missionDesc: ['पहली बुवाई के लिए खेत तैयार करें। गाँव से बीज का पैकेट लें।', 'मिट्टी तैयार है। खेत जोतें, फिर सरसों बोएँ।', 'फसल को थोड़ा समय दें। दो दिन आराम करें, फिर मंडी ले जाएँ।', 'खेत की अच्छी शुरुआत। कमाई लेकर देखें गाँव को अब किस चीज़ की ज़रूरत है।'],
      objectives: ['गाँव की दुकान · 118 मी', 'खेत · 42 मी', 'फसल के लिए इंतज़ार', 'मंडी · 94 मी'],
      actions: ['दुकानदार से बात करें', 'खेत पर काम करें', 'उपज बेचें', 'आसपास देखें'],
      progress: ['0 / 3', '1 / 3', '2 / 3', '3 / 3'],
      taskLabels: ['मुख्य काम', 'मुख्य काम', 'मुख्य काम', 'काम पूरा'],
      locations: ['खेड़ा · पुश्तैनी खेत', 'खेड़ा · गाँव की दुकान', 'खेड़ा · मंडी यार्ड'],
      tip: 'दुकानदार के पास बीज के पैकेट हैं।', notReady: 'पहले खेत जोतना होगा।', needSeed: 'गाँव की दुकान से बीज लें।', planted: 'सरसों बो दी। अब इसे बढ़ने दें।', growing: 'फसल बढ़ रही है। तैयार होने तक आराम करें।', ripe: 'सरसों तैयार है। इसे काट लें।', harvest: 'फसल मिल गई। बेचने के लिए मंडी जाएँ।', sold: 'उपज बिक गई। खेत की स्थिति सुधर रही है।', shopBuy: 'बीज आपके बैग में रख दिए।', wait: 'रात को आराम किया। एक नया दिन शुरू होता है।', noProduce: 'अभी बेचने के लिए कुछ नहीं। खेत देखें।', done: 'पहला खेती चक्र पूरा हुआ!', save: 'गेम सेव हुआ'
    }
  };
  const t = (key) => strings[state.language][key];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const rand = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(canvas.clientWidth * dpr);
    canvas.height = Math.round(canvas.clientHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener('resize', resize); resize();

  function roundRect(c, x, y, w, h, r, fill, stroke) {
    c.beginPath(); c.roundRect(x, y, w, h, r);
    if (fill) { c.fillStyle = fill; c.fill(); }
    if (stroke) { c.strokeStyle = stroke; c.stroke(); }
  }
  function line(c, x1, y1, x2, y2, color, width) {
    c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.strokeStyle = color; c.lineWidth = width; c.lineCap = 'round'; c.stroke();
  }
  function drawRoad(c) {
    c.save(); c.lineCap = 'round'; c.lineJoin = 'round';
    c.beginPath(); c.moveTo(-50, 840); c.bezierCurveTo(240, 790, 485, 850, 742, 792); c.bezierCurveTo(980, 739, 1038, 641, 1144, 622); c.bezierCurveTo(1302, 592, 1455, 676, 1860, 650);
    c.strokeStyle = '#766f55'; c.lineWidth = 142; c.stroke();
    c.strokeStyle = '#c3b98f'; c.lineWidth = 128; c.stroke();
    c.strokeStyle = 'rgba(239,224,177,.42)'; c.lineWidth = 2; c.setLineDash([14, 17]); c.stroke(); c.setLineDash([]);
    // roadside edge and worn marks
    c.beginPath(); c.moveTo(-30, 767); c.bezierCurveTo(245, 719, 495, 780, 730, 724); c.bezierCurveTo(955, 670, 1001, 573, 1123, 553); c.bezierCurveTo(1320, 522, 1470, 604, 1840, 582);
    c.strokeStyle = 'rgba(91,86,62,.32)'; c.lineWidth = 3; c.stroke();
    for (let i = 0; i < 18; i++) {
      const x = 80 + i * 89, y = 817 - Math.sin(i * .36) * 22;
      c.beginPath(); c.ellipse(x, y, 14 + rand(i) * 16, 3, -.08, 0, Math.PI * 2); c.fillStyle = 'rgba(106,100,75,.18)'; c.fill();
    }
    c.restore();
  }
  function drawGround(c) {
    c.fillStyle = '#76825a'; c.fillRect(0, 0, W, H);
    const g = c.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#82906a'); g.addColorStop(.42, '#718057'); g.addColorStop(1, '#647450'); c.fillStyle = g; c.fillRect(0, 0, W, H);
    // patches of scrub and field-edge grasses
    for (let i = 0; i < 410; i++) {
      const x = rand(i + 14) * W, y = rand(i + 247) * H;
      c.beginPath(); c.ellipse(x, y, 6 + rand(i + 91) * 19, 3 + rand(i + 32) * 9, rand(i + 70) * 3.1, 0, Math.PI * 2);
      c.fillStyle = i % 3 ? 'rgba(53,73,46,.10)' : 'rgba(196,176,108,.11)'; c.fill();
    }
    // distant crop band / scrubland beyond the village
    c.fillStyle = 'rgba(172,171,108,.26)'; c.fillRect(0, 88, W, 86);
    for (let i = 0; i < 52; i++) {
      const x = i * 39 + rand(i) * 12;
      c.beginPath(); c.ellipse(x, 125 + rand(i + 2) * 28, 18 + rand(i + 4) * 24, 9 + rand(i + 9) * 12, 0, 0, Math.PI * 2);
      c.fillStyle = i % 2 ? '#727b50' : '#879060'; c.fill();
    }
  }
  function drawBuilding(c, x, y, w, h, roof, wall, opts = {}) {
    c.save();
    c.fillStyle = 'rgba(22,29,18,.24)'; c.beginPath(); c.ellipse(x + w / 2 + 8, y + h + 10, w * .59, 13, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = wall; c.fillRect(x, y + 9, w, h);
    c.fillStyle = opts.trim || '#d2bd91'; c.fillRect(x + 7, y + 13, w - 14, h - 4);
    c.beginPath(); c.moveTo(x - 9, y + 13); c.lineTo(x + w * .48, y - 11); c.lineTo(x + w + 10, y + 13); c.closePath(); c.fillStyle = roof; c.fill();
    c.beginPath(); c.moveTo(x + w * .48, y - 11); c.lineTo(x + w + 10, y + 13); c.lineTo(x + w - 5, y + 17); c.lineTo(x + w * .47, y + 2); c.closePath(); c.fillStyle = opts.shadowRoof || '#805a3e'; c.fill();
    line(c, x + 4, y + 15, x + w - 4, y + 15, 'rgba(255,239,195,.28)', 2);
    // door and tiny windows
    c.fillStyle = opts.door || '#49382b'; c.fillRect(x + w * .45, y + h - 24, 19, 24);
    c.fillStyle = '#a8b39a'; c.fillRect(x + 15, y + 28, 17, 12); c.fillRect(x + w - 34, y + 28, 17, 12);
    c.fillStyle = 'rgba(236,215,160,.5)'; c.fillRect(x + 17, y + 30, 2, 8); c.fillRect(x + w - 32, y + 30, 2, 8);
    if (opts.label) {
      roundRect(c, x + w / 2 - 37, y - 28, 74, 14, 4, 'rgba(29,39,29,.78)');
      c.fillStyle = '#f3e9cd'; c.font = '700 7px "DM Sans"'; c.textAlign = 'center'; c.fillText(opts.label, x + w / 2, y - 18);
    }
    c.restore();
  }
  function drawTrees(c) {
    const trees = [];
    for (let i = 0; i < 68; i++) {
      let x = 45 + rand(i + 23) * 1710, y = 170 + rand(i + 92) * 960;
      if ((x < 1000 && y > 350 && y < 690) || (x > 1090 && y > 490 && y < 840)) continue;
      trees.push({ x, y, r: 13 + rand(i + 17) * 19, tone: rand(i + 71) });
    }
    // distinctive tree rows on northern edge and orchard near fields
    for (let i = 0; i < 17; i++) trees.push({ x: 225 + i * 68, y: 256 + Math.sin(i * .6) * 19, r: 22 + rand(i) * 9, tone: rand(i + 12) });
    for (let i = 0; i < 11; i++) trees.push({ x: 1016 + i * 51, y: 421 + Math.sin(i) * 12, r: 17 + rand(i + 45) * 8, tone: rand(i + 2) });
    for (const tr of trees) {
      c.fillStyle = 'rgba(20,34,21,.22)'; c.beginPath(); c.ellipse(tr.x + 7, tr.y + 10, tr.r * 1.1, tr.r * .66, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = tr.tone > .5 ? '#4d6745' : '#58734a'; c.beginPath(); c.arc(tr.x, tr.y, tr.r, 0, Math.PI * 2); c.fill();
      c.fillStyle = tr.tone > .5 ? '#6f8656' : '#778c5d'; c.beginPath(); c.arc(tr.x - tr.r * .18, tr.y - tr.r * .22, tr.r * .68, 0, Math.PI * 2); c.fill();
      c.fillStyle = 'rgba(202,197,134,.19)'; c.beginPath(); c.arc(tr.x - tr.r * .25, tr.y - tr.r * .31, tr.r * .27, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#765e3d'; c.fillRect(tr.x - 2, tr.y + tr.r * .34, 5, tr.r * .54);
    }
  }
  function drawPlot(c, p, idx) {
    const field = state.plots[idx];
    c.save();
    c.fillStyle = 'rgba(30,35,23,.25)'; c.fillRect(p.x - 7, p.y + 7, p.w + 15, p.h + 9);
    c.fillStyle = '#8f7853'; c.fillRect(p.x, p.y, p.w, p.h);
    c.strokeStyle = '#c6ae7a'; c.lineWidth = 3; c.strokeRect(p.x, p.y, p.w, p.h);
    c.fillStyle = field.ploughed ? '#68563d' : '#a0865b'; c.fillRect(p.x + 4, p.y + 4, p.w - 8, p.h - 8);
    const rows = 7;
    for (let r = 0; r < rows; r++) {
      const yy = p.y + 12 + r * 13;
      c.strokeStyle = field.ploughed ? '#93764e' : '#b19668'; c.lineWidth = 2;
      c.beginPath(); c.moveTo(p.x + 8, yy); c.lineTo(p.x + p.w - 8, yy + 3); c.stroke();
      if (field.crop && field.stage > 0) {
        for (let j = 0; j < 8; j++) {
          const xx = p.x + 18 + j * 16 + (r % 2) * 4;
          const gh = field.stage === 1 ? 8 : field.stage === 2 ? 15 : 19;
          c.strokeStyle = field.stage === 3 ? '#bdaf57' : '#68894e'; c.lineWidth = 2;
          c.beginPath(); c.moveTo(xx, yy + 5); c.lineTo(xx - 2, yy - gh); c.moveTo(xx, yy + 2); c.lineTo(xx + 4, yy - gh + 4); c.stroke();
          if (field.stage === 3) { c.fillStyle = '#dbc86e'; c.beginPath(); c.arc(xx - 2, yy - gh, 3, 0, Math.PI * 2); c.fill(); }
          else if (field.stage > 1) { c.fillStyle = '#779659'; c.beginPath(); c.ellipse(xx + 2, yy - gh + 5, 4, 2, -.4, 0, Math.PI * 2); c.fill(); }
        }
      }
    }
    c.fillStyle = 'rgba(30,34,24,.72)'; c.font = '700 7px "DM Sans"'; c.textAlign = 'center'; c.fillText(p.label, p.x + p.w / 2, p.y + p.h + 15);
    if (field.crop && field.stage === 3) {
      c.beginPath(); c.arc(p.x + p.w - 3, p.y + 1, 6, 0, Math.PI * 2); c.fillStyle = '#d9c170'; c.fill();
    }
    c.restore();
  }
  function drawWorld() {
    ctx.save();
    drawGround(ctx);
    drawRoad(ctx);
    // homes and farm compound walls
    ctx.fillStyle = 'rgba(53,46,32,.2)'; ctx.fillRect(204, 322, 361, 340);
    // courtyard earth
    ctx.fillStyle = '#b19a6e'; ctx.fillRect(218, 346, 326, 289);
    ctx.strokeStyle = '#d0bc8d'; ctx.lineWidth = 4; ctx.strokeRect(218, 346, 326, 289);
    for (let i = 0; i < 8; i++) line(ctx, 225 + i * 39, 594, 258 + i * 35, 594, 'rgba(95,78,51,.23)', 2);
    drawBuilding(ctx, 251, 377, 161, 106, '#986841', '#c7b58d', { label: 'FAMILY HOME', shadowRoof: '#744a32' });
    drawBuilding(ctx, 428, 372, 92, 75, '#846142', '#b7a37a', { shadowRoof: '#624732' });
    // water trough and old well
    ctx.fillStyle = '#745d3d'; ctx.beginPath(); ctx.ellipse(470, 545, 27, 18, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#42675f'; ctx.beginPath(); ctx.ellipse(470, 542, 18, 10, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#baaa80'; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(470, 541, 24, 15, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#6f5840'; ctx.fillRect(462, 507, 3, 35); ctx.fillRect(479, 507, 3, 35); line(ctx, 462, 507, 482, 507, '#71543b', 3);
    // farm boundary and fields
    ctx.strokeStyle = 'rgba(206,189,142,.7)'; ctx.lineWidth = 2; ctx.setLineDash([7, 7]); ctx.strokeRect(570, 381, 420, 258); ctx.setLineDash([]);
    drawPlot(ctx, plotDefs[0], 0); drawPlot(ctx, plotDefs[1], 1);
    // short paths between plots and road
    ctx.strokeStyle = '#a9966c'; ctx.lineWidth = 15; ctx.beginPath(); ctx.moveTo(520, 599); ctx.quadraticCurveTo(570, 567, 612, 536); ctx.stroke();
    ctx.strokeStyle = '#c4b58a'; ctx.lineWidth = 10; ctx.stroke();
    // shop cluster in village street
    drawBuilding(ctx, 1137, 459, 174, 112, '#aa7350', '#cbb58c', { label: 'KHEDA GENERAL STORE', shadowRoof: '#814c37' });
    drawBuilding(ctx, 1342, 544, 122, 91, '#9e6847', '#c4b18b', { label: 'MANDI', shadowRoof: '#714b38' });
    // market awning and produce crates
    ctx.fillStyle = '#b44f3d'; ctx.fillRect(1154, 554, 119, 16); ctx.fillStyle = '#e1c38e';
    for (let i = 0; i < 5; i++) ctx.fillRect(1154 + i * 24, 554, 11, 16);
    ctx.fillStyle = '#77573c'; ctx.fillRect(1159, 579, 31, 22); ctx.fillRect(1196, 579, 31, 22); ctx.fillRect(1232, 579, 31, 22);
    for (let i = 0; i < 9; i++) { ctx.fillStyle = ['#d3a649','#b95b38','#7e9a4e'][i % 3]; ctx.beginPath(); ctx.arc(1164 + (i % 3) * 8, 584 + Math.floor(i / 3) * 4, 3, 0, Math.PI * 2); ctx.fill(); }
    // road divider, small rural stop and bollards
    drawBuilding(ctx, 1493, 394, 129, 82, '#856548', '#b9a57c', { label: 'TEA & REPAIR', shadowRoof: '#5d4936' });
    // crop rows on the far side
    ctx.fillStyle = '#7d8555'; ctx.fillRect(1048, 192, 455, 176);
    for (let r = 0; r < 9; r++) {
      ctx.strokeStyle = r % 2 ? '#9b9a62' : '#b6a765'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(1060, 208 + r * 17); ctx.bezierCurveTo(1160, 194 + r * 17, 1360, 220 + r * 17, 1495, 204 + r * 17); ctx.stroke();
      for (let i = 0; i < 22; i++) { const x = 1068 + i * 19, y = 205 + r * 17 + Math.sin(i * .5) * 3; ctx.fillStyle = '#8d9959'; ctx.beginPath(); ctx.ellipse(x, y, 4, 8, .2, 0, Math.PI * 2); ctx.fill(); }
    }
    // dirt tracks and small water channel
    ctx.strokeStyle = '#558078'; ctx.lineWidth = 18; ctx.beginPath(); ctx.moveTo(1015, 335); ctx.bezierCurveTo(1050, 395, 1020, 465, 1095, 516); ctx.stroke();
    ctx.strokeStyle = 'rgba(176,203,173,.44)'; ctx.lineWidth = 2; ctx.stroke();
    // small boundary walls / fencing around fields
    for (let i = 0; i < 8; i++) { ctx.fillStyle = '#81734f'; ctx.fillRect(566 + i * 56, 375, 4, 12); ctx.fillRect(566 + i * 56, 635, 4, 12); }
    drawTrees(ctx);
    // decorative shrubs, rocks, hay bales
    for (let i = 0; i < 28; i++) {
      const x = 535 + rand(i + 100) * 480, y = 625 + rand(i + 55) * 170;
      ctx.fillStyle = i % 3 ? '#5e7449' : '#8f8056'; ctx.beginPath(); ctx.arc(x, y, 5 + rand(i + 33) * 8, 0, Math.PI * 2); ctx.fill();
    }
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = '#b29153'; ctx.beginPath(); ctx.ellipse(580 + i * 43, 334 + (i % 2) * 14, 14, 10, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#d2b978'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(580 + i * 43, 334 + (i % 2) * 14, 14, 10, 0, 0, Math.PI * 2); ctx.stroke();
    }
    // interaction beacons
    drawBeacon(ctx, shop.x, shop.y + 55, state.missionStage === 0 ? 'SHOP' : '');
    drawBeacon(ctx, mandi.x, mandi.y + 50, state.produce > 0 ? 'SELL' : '');
    for (let i = 0; i < plotDefs.length; i++) if (state.plots[i].stage === 3) drawBeacon(ctx, plotDefs[i].x + plotDefs[i].w / 2, plotDefs[i].y + plotDefs[i].h / 2, 'HARVEST');
    drawPlayer(ctx);
    ctx.restore();
  }
  function drawBeacon(c, x, y, label) {
    if (!label) return;
    const pulse = .72 + Math.sin(performance.now() / 260) * .12;
    c.save(); c.globalAlpha = pulse;
    c.strokeStyle = '#e7c985'; c.lineWidth = 2; c.beginPath(); c.arc(x, y, 16 + Math.sin(performance.now() / 340) * 2, 0, Math.PI * 2); c.stroke();
    c.fillStyle = '#d0aa68'; c.beginPath(); c.arc(x, y, 4, 0, Math.PI * 2); c.fill();
    c.font = '700 7px "DM Sans"'; c.textAlign = 'center'; c.fillStyle = '#f4e7c4'; c.shadowColor = '#1c241c'; c.shadowBlur = 4; c.fillText(label, x, y - 23); c.restore();
  }
  function drawPlayer(c) {
    const x = player.x, y = player.y, d = Math.hypot(player.vx, player.vy);
    c.save();
    c.fillStyle = 'rgba(22,27,21,.28)'; c.beginPath(); c.ellipse(x, y + 10, 16, 7, 0, 0, Math.PI * 2); c.fill();
    // shoes and trousers shift with stride
    const stride = Math.sin(performance.now() / (d > 1 ? 68 : 260)) * (d > 1 ? 3 : 0.5);
    c.fillStyle = '#d2c8b0'; c.beginPath(); c.ellipse(x - 5, y + 9 + stride, 4, 6, -.2, 0, Math.PI * 2); c.ellipse(x + 5, y + 9 - stride, 4, 6, .2, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#574438'; c.beginPath(); c.roundRect(x - 8, y - 1 + stride * .5, 7, 12, 3); c.roundRect(x + 1, y - 1 - stride * .5, 7, 12, 3); c.fill();
    // arms then navy shirt
    c.strokeStyle = '#b57555'; c.lineWidth = 5; c.lineCap = 'round'; c.beginPath(); c.moveTo(x - 10, y - 5); c.lineTo(x - 14, y + 4); c.moveTo(x + 10, y - 5); c.lineTo(x + 14, y + 4); c.stroke();
    c.fillStyle = '#18212a'; c.beginPath(); c.roundRect(x - 11, y - 13, 22, 21, 6); c.fill();
    c.fillStyle = '#10171d'; c.fillRect(x - 4, y - 11, 8, 12);
    // collar and pocket accents
    c.strokeStyle = '#687079'; c.lineWidth = 1; c.beginPath(); c.moveTo(x, y - 10); c.lineTo(x - 3, y - 5); c.lineTo(x, y - 2); c.lineTo(x + 3, y - 5); c.stroke();
    c.fillStyle = '#bf443c'; c.fillRect(x + 11, y + 1, 4, 2); c.fillRect(x + 12, y + 4, 3, 1);
    // head and dark textured hair
    c.fillStyle = '#a96e50'; c.beginPath(); c.ellipse(x, y - 18, 7, 8, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#181719'; c.beginPath(); c.ellipse(x, y - 21, 7.5, 6.5, -.1, Math.PI, Math.PI * 2); c.fill(); c.beginPath(); c.arc(x - 4, y - 21, 4, 0, Math.PI * 2); c.fill(); c.beginPath(); c.arc(x + 3, y - 23, 4, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#2a1b19'; c.beginPath(); c.arc(x, y - 14, 4.2, 0, Math.PI); c.fill();
    c.restore();
  }

  function getZoom(width, height) {
    return width < 620 ? Math.min(width / 430, height / 1050) * .92 : Math.min(width / 1020, height / 690) * 1.12;
  }
  function worldToScreen(x, y, cam) {
    const width = canvas.clientWidth, height = canvas.clientHeight;
    const scale = getZoom(width, height);
    return { x: (x - cam.x) * scale + width / 2, y: (y - cam.y) * scale + height / 2 };
  }
  function getCamera() {
    const width = canvas.clientWidth, height = canvas.clientHeight;
    const scale = getZoom(width, height);
    const viewW = width / scale, viewH = height / scale;
    return { x: clamp(player.x, viewW * .5, W - viewW * .5), y: clamp(player.y, viewH * .5, H - viewH * .5), scale };
  }
  function render() {
    const width = canvas.clientWidth, height = canvas.clientHeight;
    ctx.clearRect(0, 0, width, height);
    const cam = getCamera();
    ctx.save(); ctx.translate(width / 2, height / 2); ctx.scale(cam.scale, cam.scale); ctx.translate(-cam.x, -cam.y);
    drawWorld(); ctx.restore();
    const hour = (state.timeMinutes / 60) % 24;
    if (hour < 6 || hour >= 20) {
      ctx.fillStyle = 'rgba(12, 24, 43, .37)'; ctx.fillRect(0, 0, width, height);
    } else if (hour < 7.5 || hour >= 18.2) {
      const warmth = hour < 7.5 ? (7.5 - hour) / 1.5 : (hour - 18.2) / 2.4;
      ctx.fillStyle = `rgba(193, 111, 54, ${Math.min(.14, warmth * .14)})`; ctx.fillRect(0, 0, width, height);
    }
    updateMap();
  }
  function updateMap() {
    const c = mapCtx; c.clearRect(0, 0, 220, 142); c.fillStyle = '#697c53'; c.fillRect(0, 0, 220, 142);
    c.fillStyle = '#6e8958'; c.fillRect(17, 14, 116, 114);
    c.strokeStyle = '#b8ae87'; c.lineWidth = 15; c.beginPath(); c.moveTo(-5, 105); c.bezierCurveTo(42, 101, 74, 112, 108, 97); c.bezierCurveTo(142, 84, 137, 69, 170, 68); c.bezierCurveTo(189, 68, 200, 77, 227, 72); c.stroke();
    c.strokeStyle = '#d4c597'; c.lineWidth = 12; c.stroke();
    c.fillStyle = '#b99e76'; c.fillRect(29, 44, 29, 22); c.fillStyle = '#9d7854'; c.fillRect(28, 39, 31, 10);
    for (const p of plotDefs) { c.fillStyle = state.plots[plotDefs.indexOf(p)].stage === 3 ? '#b5a657' : '#8c7450'; c.fillRect(67 + (p.x - 620) * .11, 46 + (p.y - 432) * .1, 19, 13); }
    c.fillStyle = '#a66e4d'; c.fillRect(144, 56, 20, 15); c.fillRect(169, 75, 17, 13);
    c.fillStyle = '#c9b47c'; c.beginPath(); c.arc(shop.x / W * 220, shop.y / H * 142, 2.6, 0, Math.PI * 2); c.fill();
    c.fillStyle = state.produce > 0 ? '#e4855c' : '#dbc98a'; c.beginPath(); c.arc(mandi.x / W * 220, mandi.y / H * 142, 3, 0, Math.PI * 2); c.fill();
    const target = updateObjective(); c.fillStyle = '#e48765'; c.beginPath(); c.arc(target.x / W * 220, target.y / H * 142, 4, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#f6e4b3'; c.beginPath(); c.arc(player.x / W * 220, player.y / H * 142, 3.3, 0, Math.PI * 2); c.fill(); c.strokeStyle = '#f6e4b3'; c.lineWidth = 1; c.beginPath(); c.arc(player.x / W * 220, player.y / H * 142, 6, 0, Math.PI * 2); c.stroke();
  }

  function updateHud() {
    $('moneyText').textContent = `₹ ${state.money.toLocaleString('en-IN')}`;
    $('dayText').textContent = `DAY ${String(state.day).padStart(2, '0')}`;
    const hh = Math.floor(state.timeMinutes / 60) % 24, mm = Math.floor(state.timeMinutes % 60);
    $('timeText').textContent = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
    $('missionTitle').textContent = t('missionTitle')[Math.min(state.missionStage, 3)];
    $('missionDescription').textContent = t('missionDesc')[Math.min(state.missionStage, 3)];
    $('progressText').textContent = t('progress')[Math.min(state.missionStage, 3)];
    $('progressFill').style.width = `${Math.min(state.missionStage, 3) / 3 * 100}%`;
    $('rewardText').innerHTML = state.missionStage >= 3 ? 'REWARD <b>COLLECTED</b>' : `REWARD <b>+₹ ${state.missionStage === 2 ? '400' : '400'}</b>`;
    $('missionCard').querySelector('.eyebrow').childNodes[0].textContent = t('taskLabels')[Math.min(state.missionStage, 3)] + ' ';
    $('objectiveText').textContent = t('objectives')[Math.min(state.missionStage, 3)];
    if (player.x > 1050 && player.y > 410) $('locationName').textContent = t('locations')[player.y > 640 ? 2 : 1];
    else $('locationName').textContent = t('locations')[0];
    $('missionCard').classList.toggle('complete', state.questComplete);
  }
  function findInteraction() {
    let best = null, bestDist = 94;
    const candidates = [
      { type: 'shop', x: shop.x, y: shop.y + 76, label: t('actions')[0] },
      { type: 'mandi', x: mandi.x + 5, y: mandi.y + 80, label: t('actions')[2] },
      { type: 'home', x: home.x + 64, y: home.y + 141, label: 'Rest at farmhouse' },
      { type: 'board', x: farmSign.x, y: farmSign.y, label: 'Farm noticeboard' },
      ...plotDefs.map((p, i) => ({ type: 'plot', index: i, x: p.x + p.w / 2, y: p.y + p.h / 2, label: t('actions')[1] }))
    ];
    for (const item of candidates) {
      const d = distance(player, item);
      if (d < bestDist) { best = { ...item, dist: d }; bestDist = d; }
    }
    state.interaction = best;
    const toast = $('interactionToast');
    if (best) { $('interactionText').textContent = best.label; toast.classList.add('visible'); }
    else toast.classList.remove('visible');
  }
  function updateObjective() {
    if (state.missionStage === 0) return { x: shop.x, y: shop.y + 50 };
    if ((state.missionStage === 1 || state.missionStage === 2) && state.produce > 0) return { x: mandi.x, y: mandi.y + 55 };
    if (state.missionStage === 1 || state.missionStage === 2) return { x: plotDefs[0].x + 70, y: plotDefs[0].y + 48 };
    return { x: farmSign.x, y: farmSign.y };
  }
  function updateObjectiveDistance() {
    const o = updateObjective(); const d = Math.round(distance(player, o) / 3.2);
    let label;
    if (state.missionStage === 2 && state.produce > 0) label = state.language === 'EN' ? 'Mandi · sell harvest' : 'मंडी · फसल बेचें';
    else if (state.missionStage === 2 && state.plots.some(p => p.stage === 3)) label = state.language === 'EN' ? 'Farm plots · harvest' : 'खेत · फसल काटें';
    else if (state.missionStage >= 3) label = state.language === 'EN' ? 'Family farm · story complete' : 'पुश्तैनी खेत · कहानी पूरी';
    else label = t('objectives')[state.missionStage].split(' · ')[0];
    $('objectiveText').textContent = `${label} · ${d} m`;
  }
  function toast(message, emphasis = '') {
    const el = document.createElement('div'); el.className = 'toast-message';
    el.innerHTML = emphasis ? `${message} <strong>${emphasis}</strong>` : message;
    $('toastStack').appendChild(el); setTimeout(() => el.remove(), 2650);
  }
  function save(show = false) {
    try {
      const snapshot = { version: 1, state: { money: state.money, seeds: state.seeds, produce: state.produce, day: state.day, timeMinutes: state.timeMinutes, plots: state.plots, missionStage: state.missionStage, harvested: state.harvested, sold: state.sold, questComplete: state.questComplete }, player: { x: player.x, y: player.y } };
      localStorage.setItem('raasta6-save-v1', JSON.stringify(snapshot));
      if (show) { $('saveIndicator').classList.add('show'); setTimeout(() => $('saveIndicator').classList.remove('show'), 1500); }
    } catch (_) { }
  }
  function addMoney(amount) {
    state.money += amount; $('moneyChange').textContent = `+₹${amount}`; $('moneyChange').classList.add('show'); setTimeout(() => $('moneyChange').classList.remove('show'), 1700);
  }
  function buySeeds() {
    const price = 120;
    if (state.money < price) { toast('Not enough money for a seed packet.'); return; }
    state.money -= price; state.seeds += 4; updateHud(); toast(t('shopBuy'), '+4 MUSTARD SEEDS'); save(true); closeModal();
    if (state.missionStage === 0) state.missionStage = 1;
    updateHud(); save();
  }
  function ploughAndSow(index) {
    const plot = state.plots[index];
    if (!plot.ploughed) {
      plot.ploughed = true; state.timeMinutes += 18; toast('Plot ploughed. Ready for sowing.'); save(true); openPlot(index); return;
    }
    if (!plot.crop) {
      if (!state.seeds) { toast(t('needSeed')); return; }
      plot.crop = 'mustard'; plot.stage = 1; plot.growth = 0; state.seeds--;
      if (state.missionStage === 1) state.missionStage = 2;
      state.timeMinutes += 12; toast(t('planted'), 'MUSTARD'); closeModal(); updateHud(); save(true); return;
    }
    if (plot.stage < 3) { toast(t('growing')); return; }
    plot.stage = 0; plot.crop = ''; plot.growth = 0; state.produce += 1; state.harvested = true;
    state.timeMinutes += 22; toast(t('harvest'), '+1 MUSTARD'); closeModal(); updateHud(); save(true);
  }
  function advanceDay() {
    state.day++;
    state.timeMinutes = 6 * 60 + 15;
    let changed = false;
    for (const plot of state.plots) {
      if (plot.crop && plot.stage > 0 && plot.stage < 3) { plot.stage++; plot.growth++; changed = true; }
    }
    toast(t('wait'), changed ? 'CROPS GROWING' : 'DAY ' + String(state.day).padStart(2, '0'));
    save(true); updateHud();
  }
  function sellProduce() {
    if (!state.produce) { toast(t('noProduce')); return; }
    const qty = state.produce, total = qty * 400;
    state.produce = 0; addMoney(total); state.sold = true;
    if (state.missionStage === 2) { state.missionStage = 3; state.questComplete = true; toast(t('done'), `+₹ ${total}`); }
    else toast(`${qty} bag${qty > 1 ? 's' : ''} of mustard sold at the mandi.`, `+₹ ${total}`);
    updateHud(); closeModal(); save(true);
  }
  function interact() {
    const target = state.interaction;
    if (!target) { toast('Nothing nearby to interact with.'); return; }
    switch (target.type) {
      case 'shop': openShop(); break;
      case 'mandi': openMandi(); break;
      case 'plot': openPlot(target.index); break;
      case 'home': advanceDay(); break;
      case 'board': openJournal(); break;
    }
  }
  function openModal(title, eyebrow, html, type) {
    state.modal = type; $('modalTitle').textContent = title; $('modalEyebrow').textContent = eyebrow;
    $('modalContent').innerHTML = html; $('modalBackdrop').hidden = false; state.paused = true;
  }
  function closeModal() { $('modalBackdrop').hidden = true; state.modal = null; state.paused = false; }
  function openShop() {
    const price = 120;
    openModal('Village general store', 'KHEDA · SHOP', `<p class="modal-copy">A quiet little shop with the essentials for the fields. Seed packets are fresh from this season's crop.</p><div class="shop-item"><span class="item-glyph">✳</span><div><b>Mustard seed packet</b><small>4 seeds · good for the cool season</small></div><button id="buySeedButton">₹ ${price}</button></div><p class="modal-copy" style="margin:14px 0 0">Wallet balance <strong style="color:#e2d3aa">₹ ${state.money.toLocaleString('en-IN')}</strong></p>`, 'shop');
    $('buySeedButton').addEventListener('click', buySeeds);
  }
  function openPlot(index) {
    const p = state.plots[index];
    let title = `${index === 0 ? 'North' : 'South'} plot`, copy = '', action = '', button = '';
    if (!p.ploughed) { copy = 'Packed earth, ready for a first pass. Plough the furrows before sowing.'; action = 'PLOUGH PLOT'; button = 'Plough this plot'; }
    else if (!p.crop) { copy = state.seeds ? `The furrows are ready. You have ${state.seeds} mustard seed${state.seeds === 1 ? '' : 's'} in your bag.` : t('needSeed'); action = 'SOW MUSTARD'; button = 'Sow this plot'; }
    else if (p.stage === 1) { copy = 'Freshly sown. Tiny shoots will show after a day of good weather.'; action = 'GROWING · DAY 1'; button = 'Close'; }
    else if (p.stage === 2) { copy = 'The seedlings are strong and green. Another day and the crop should be ready.'; action = 'GROWING · DAY 2'; button = 'Close'; }
    else { copy = 'Golden mustard heads are ready to cut. Bring the crop in before the weather turns.'; action = 'READY TO HARVEST'; button = 'Harvest crop'; }
    const disabled = p.ploughed && !p.crop && !state.seeds;
    openModal(title, `FARM · ${plotDefs[index].label}`, `<p class="modal-copy">${copy}</p><div class="inventory-row"><span>Soil condition</span><span>${p.ploughed ? 'PREPARED' : 'UNPLOUGHED'}</span></div><div class="inventory-row" style="margin-top:7px"><span>Crop status</span><span>${!p.crop ? 'EMPTY' : ['','SOWN','GROWING','MATURE'][p.stage]}</span></div><button class="modal-action" id="plotAction" ${disabled ? 'disabled' : ''}>${action}</button>`, 'plot');
    $('plotAction').addEventListener('click', () => {
      if (p.stage === 1 || p.stage === 2) { closeModal(); return; }
      ploughAndSow(index);
    });
    $('plotAction').title = button;
    if (disabled) $('plotAction').textContent = 'NO SEEDS · VISIT THE SHOP';
  }
  function openMandi() {
    const qty = state.produce;
    openModal('Kheda mandi', 'SELL YOUR HARVEST', `<p class="modal-copy">A local buyer weighs each bag and posts today's village rate. Produce is always bought at a fair, bounded price.</p><div class="inventory-row"><span>Mustard · ${qty} bag${qty === 1 ? '' : 's'}</span><span>₹ ${qty * 400}</span></div><button class="modal-action" id="sellButton" ${qty === 0 ? 'disabled' : ''}>${qty ? `SELL HARVEST · ₹ ${qty * 400}` : 'NOTHING TO SELL'}</button>`, 'mandi');
    $('sellButton').addEventListener('click', sellProduce);
  }
  function inventoryHtml() {
    openModal('Your bag', 'ARJUN · INVENTORY', `<p class="modal-copy">A few things for the road and a bit of work waiting back at the farm.</p><div class="inventory-list"><div class="inventory-row"><span>Mustard seeds</span><span>× ${state.seeds}</span></div><div class="inventory-row"><span>Harvested mustard</span><span>× ${state.produce}</span></div><div class="inventory-row"><span>Wallet</span><span>₹ ${state.money.toLocaleString('en-IN')}</span></div></div>`, 'inventory');
  }
  function openJournal() {
    const current = t('missionDesc')[Math.min(state.missionStage, 3)];
    openModal('Arjun’s journal', 'CHAPTER 01 · THE WAY BACK', `<p class="journal-note">${current}</p><div class="inventory-row"><span>Family farm</span><span>${state.questComplete ? 'STABLE' : 'IN PROGRESS'}</span></div><div class="inventory-row" style="margin-top:7px"><span>Current season</span><span>MONSOON</span></div><p class="modal-copy" style="margin:14px 0 0">“Home looks smaller than I remember. The work, though — there’s plenty of it.”</p>`, 'journal');
  }
  function doMove(dt) {
    if (state.paused) { player.vx = player.vy = 0; return; }
    const k = state.keys;
    let ix = (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0) + state.joyX;
    let iy = (k.KeyS || k.ArrowDown ? 1 : 0) - (k.KeyW || k.ArrowUp ? 1 : 0) + state.joyY;
    let len = Math.hypot(ix, iy); if (len > 1) { ix /= len; iy /= len; }
    player.running = !!(k.ShiftLeft || k.ShiftRight || state.runTouch);
    const speed = player.speed * (player.running ? 1.62 : 1);
    const targetVX = ix * speed, targetVY = iy * speed;
    const ease = 1 - Math.exp(-dt * (len ? 11 : 13));
    player.vx += (targetVX - player.vx) * ease; player.vy += (targetVY - player.vy) * ease;
    if (Math.abs(player.vx) < 2) player.vx = 0; if (Math.abs(player.vy) < 2) player.vy = 0;
    if (Math.hypot(player.vx, player.vy) > 3) { player.dirX = player.vx; player.dirY = player.vy; }
    player.x = clamp(player.x + player.vx * dt, 35, W - 35); player.y = clamp(player.y + player.vy * dt, 90, H - 35);
    state.timeMinutes += dt * 1.7;
  }
  let last = performance.now(), hudTimer = 0;
  function loop(now) {
    const dt = Math.min((now - last) / 1000, .04); last = now;
    doMove(dt); findInteraction(); render();
    hudTimer += dt; if (hudTimer > .4) { updateHud(); updateObjectiveDistance(); hudTimer = 0; }
    if (Math.random() < .0002) save();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  window.addEventListener('keydown', (e) => {
    if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)) e.preventDefault();
    state.keys[e.code] = true;
    if (e.repeat) return;
    if (e.code === 'KeyE' || e.code === 'Enter') interact();
    if (e.code === 'KeyI') inventoryHtml();
    if (e.code === 'KeyJ') openJournal();
    if (e.code === 'KeyR' && !state.modal) advanceDay();
    if (e.code === 'Escape') state.modal ? closeModal() : save(true);
  });
  window.addEventListener('keyup', (e) => { state.keys[e.code] = false; });
  $('touchInteract').addEventListener('pointerdown', (e) => { e.preventDefault(); interact(); });
  $('touchRun').addEventListener('pointerdown', () => { state.runTouch = true; });
  ['pointerup','pointercancel','pointerleave'].forEach(ev => $('touchRun').addEventListener(ev, () => { state.runTouch = false; }));
  const joy = $('joystick'), knob = $('joyKnob'); let joyId = null;
  joy.addEventListener('pointerdown', e => { joyId = e.pointerId; joy.setPointerCapture(joyId); setJoy(e); });
  joy.addEventListener('pointermove', e => { if (e.pointerId === joyId) setJoy(e); });
  const releaseJoy = e => { if (e.pointerId === joyId) { joyId = null; state.joyX = state.joyY = 0; knob.style.transform = 'translate(0,0)'; } };
  joy.addEventListener('pointerup', releaseJoy); joy.addEventListener('pointercancel', releaseJoy);
  function setJoy(e) { const r = joy.getBoundingClientRect(); let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2); const max = 34, d = Math.hypot(dx, dy); if (d > max) { dx = dx / d * max; dy = dy / d * max; } state.joyX = dx / max; state.joyY = dy / max; knob.style.transform = `translate(${dx}px,${dy}px)`; }

  $('waitButton').addEventListener('click', advanceDay);
  $('inventoryButton').addEventListener('click', inventoryHtml);
  $('journalButton').addEventListener('click', openJournal);
  $('modalClose').addEventListener('click', closeModal);
  $('modalBackdrop').addEventListener('click', e => { if (e.target === $('modalBackdrop')) closeModal(); });
  $('collapseMission').addEventListener('click', () => $('missionCard').classList.toggle('collapsed'));
  $('trackButton').addEventListener('click', () => { const o = updateObjective(); const scr = worldToScreen(o.x, o.y, getCamera()); toast(`Objective tracked · ${Math.round(distance(player, o) / 3.2)} m away`); });
  $('mapExpand').addEventListener('click', () => {
    const expanded = $('mapCard').classList.toggle('expanded');
    $('mapExpand').setAttribute('aria-label', expanded ? 'Collapse map' : 'Expand map');
  });
  $('langButton').addEventListener('click', () => { state.language = state.language === 'EN' ? 'HI' : 'EN'; $('langButton').innerHTML = `${state.language === 'EN' ? 'HI' : 'EN'} <span>⌄</span>`; updateHud(); });
  $('soundButton').addEventListener('click', () => { state.sound = !state.sound; $('soundButton').style.opacity = state.sound ? '1' : '.45'; toast('Ambient audio is not included in this prototype.'); });
  $('waitButton').title = 'Rest and advance the day (R)';
  updateHud(); updateObjectiveDistance();
  setTimeout(() => toast('Welcome back to Kheda. The family farm needs a hand.'), 750);
})();
