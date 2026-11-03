/*
  WIPS · Allocation Lab
  Console separata di simulazione. Non modifica P, prices, CSV, backup o
  localStorage principale dell'app: conserva solo preferenze e bozze di piano.
*/
(function () {
  "use strict";

  var ALLOCATION_LAB_STORAGE_KEY = "wips_allocation_lab_v1";
  var ALLOCATION_LAB_DEFAULT_POOL = 5600;
  var ALLOCATION_LAB_DEFAULT_MAX_WEIGHT = 15;
  var ALLOCATION_LAB_MAX_POOL = 1000000;
  var allocationLabState = null;

  function allocFinite(value, fallback) {
    var n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function allocClamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function allocEscape(value) {
    if (typeof advEsc === "function") return advEsc(value);
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function allocMoney(value, digits) {
    if (!Number.isFinite(value)) return '<span class="mu">—</span>';
    return N(value, digits === undefined ? 2 : digits, " €");
  }

  function allocPercent(value, digits) {
    if (!Number.isFinite(value)) return '<span class="mu">—</span>';
    return N(value, digits === undefined ? 1 : digits, "%");
  }

  function allocPlain(value, digits) {
    if (!Number.isFinite(value)) return "—";
    return formatDisplayNumber(value, digits === undefined ? 2 : digits);
  }

  function allocStateDefaults(ids) {
    var first = ids[0] || "";
    var ethereum = ids.indexOf("ethereum") >= 0 ? "ethereum" : first;
    return {
      pool: ALLOCATION_LAB_DEFAULT_POOL,
      maxWeight: ALLOCATION_LAB_DEFAULT_MAX_WEIGHT,
      scenario: "custom",
      allocations: {},
      goalAsset: ethereum,
      goalCapital: 6000,
      timelineAsset: ethereum,
      timelineAmount: 1000,
      tranches: 3,
    };
  }

  function allocSanitizeState(raw, rows) {
    var ids = rows.map(function (row) {
      return row.a.id;
    });
    var defaults = allocStateDefaults(ids);
    raw = raw && typeof raw === "object" ? raw : {};
    var allowedScenarios = ["custom", "prudent", "balanced", "dynamic"];
    var cleaned = {
      pool: allocClamp(
        allocFinite(raw.pool, defaults.pool),
        0,
        ALLOCATION_LAB_MAX_POOL,
      ),
      maxWeight: allocClamp(
        allocFinite(raw.maxWeight, defaults.maxWeight),
        3,
        60,
      ),
      scenario:
        allowedScenarios.indexOf(raw.scenario) >= 0
          ? raw.scenario
          : defaults.scenario,
      allocations: {},
      goalAsset:
        ids.indexOf(raw.goalAsset) >= 0 ? raw.goalAsset : defaults.goalAsset,
      goalCapital: allocClamp(
        allocFinite(raw.goalCapital, defaults.goalCapital),
        0,
        ALLOCATION_LAB_MAX_POOL * 10,
      ),
      timelineAsset:
        ids.indexOf(raw.timelineAsset) >= 0
          ? raw.timelineAsset
          : defaults.timelineAsset,
      timelineAmount: allocClamp(
        allocFinite(raw.timelineAmount, defaults.timelineAmount),
        0,
        ALLOCATION_LAB_MAX_POOL,
      ),
      tranches: [3, 4, 6].indexOf(Number(raw.tranches)) >= 0
        ? Number(raw.tranches)
        : defaults.tranches,
    };
    var sourceAllocations =
      raw.allocations && typeof raw.allocations === "object"
        ? raw.allocations
        : {};
    ids.forEach(function (id) {
      var amount = allocFinite(sourceAllocations[id], 0);
      if (amount > 0) cleaned.allocations[id] = Math.min(amount, ALLOCATION_LAB_MAX_POOL);
    });
    return cleaned;
  }

  function allocationBaseRows(portfolio) {
    var snapshot = buildAdvisorSnapshot(0, portfolio || P);
    return snapshot.rows.filter(function (row) {
      return row.c.price !== null && row.c.price > 0;
    });
  }

  function allocationState(rows) {
    if (!allocationLabState) {
      var saved = null;
      try {
        var raw = localStorage.getItem(ALLOCATION_LAB_STORAGE_KEY);
        saved = raw ? JSON.parse(raw) : null;
      } catch (error) {
        console.warn("WIPS Allocation Lab: stato locale non leggibile", error);
      }
      allocationLabState = allocSanitizeState(saved, rows);
    } else {
      allocationLabState = allocSanitizeState(allocationLabState, rows);
    }
    return allocationLabState;
  }

  function allocationSave() {
    try {
      localStorage.setItem(
        ALLOCATION_LAB_STORAGE_KEY,
        JSON.stringify(allocationLabState),
      );
    } catch (error) {
      console.warn("WIPS Allocation Lab: impossibile salvare la bozza", error);
    }
  }

  function allocationRisk(row) {
    var id = String(row.a.id).toLowerCase();
    var name = String(row.a.name).toLowerCase();
    if (row.t === "crypto") {
      if (id === "bitcoin") return 72;
      if (id === "ethereum") return 78;
      if (id === "ripple" || id === "chainlink") return 84;
      return 91;
    }
    if (id.indexOf("core-stoxx") >= 0) return 42;
    if (id.indexOf("msci-japan") >= 0) return 54;
    if (id.indexOf("ftse-developed") >= 0) return 59;
    if (id.indexOf("cea1") >= 0 || name.indexOf("asia") >= 0) return 71;
    if (id.indexOf("xaix") >= 0 || name.indexOf("ai") >= 0) return 74;
    if (id.indexOf("cibr") >= 0 || name.indexOf("cyber") >= 0) return 73;
    if (id.indexOf("qntm") >= 0 || name.indexOf("quantum") >= 0) return 87;
    if (id.indexOf("wnuc") >= 0 || name.indexOf("uran") >= 0) return 82;
    if (id.indexOf("copx") >= 0 || name.indexOf("copper") >= 0) return 79;
    if (id.indexOf("rbot") >= 0 || name.indexOf("automation") >= 0) return 72;
    return 65;
  }

  function allocationRoleBonus(row) {
    var id = String(row.a.id).toLowerCase();
    if (
      id.indexOf("core-stoxx") >= 0 ||
      id.indexOf("msci-japan") >= 0 ||
      id.indexOf("ftse-developed") >= 0
    )
      return 18;
    if (row.t === "etf") return 11;
    if (row.a.id === "bitcoin" || row.a.id === "ethereum") return 7;
    return 3;
  }

  function allocationBuildSnapshot(portfolio) {
    var baseRows = allocationBaseRows(portfolio);
    var state = allocationState(baseRows);
    var totalValue = baseRows.reduce(function (sum, row) {
      return sum + (row.c.va !== null ? row.c.va : row.c.cost);
    }, 0);
    var planned = Object.keys(state.allocations).reduce(function (sum, id) {
      return sum + Math.max(0, allocFinite(state.allocations[id], 0));
    }, 0);
    var denominatorWithPool = totalValue + state.pool;
    var postTotal = totalValue + planned;
    var rows = baseRows.map(function (base) {
      var value = base.c.va !== null ? base.c.va : base.c.cost;
      var weight = totalValue > 0 ? (value / totalValue) * 100 : 0;
      var allocation = Math.max(0, allocFinite(state.allocations[base.a.id], 0));
      var postWeight =
        postTotal > 0 ? ((value + allocation) / postTotal) * 100 : 0;
      var discount =
        base.c.pm > 0 && base.c.price !== null
          ? ((base.c.pm - base.c.price) / base.c.pm) * 100
          : 0;
      var downFromPm = Math.max(0, discount);
      var capValue = (state.maxWeight / 100) * denominatorWithPool;
      var maxAllocation = Math.max(0, capValue - value);
      var capacityScore = allocClamp(
        ((state.maxWeight - weight) / state.maxWeight) * 25,
        0,
        25,
      );
      var score = Math.round(
        allocClamp(downFromPm * 1.15, 0, 38) +
          capacityScore +
          allocationRoleBonus(base) +
          allocClamp((100 - allocationRisk(base)) * 0.12, 0, 12),
      );
      score = allocClamp(score, 0, 100);
      return {
        a: base.a,
        t: base.t,
        c: base.c,
        profile: advAssetProfile(base.a, base.t),
        value: value,
        weight: weight,
        allocation: allocation,
        postWeight: postWeight,
        discount: discount,
        risk: allocationRisk(base),
        score: score,
        maxAllocation: maxAllocation,
        capacityScore: capacityScore,
      };
    });
    rows.sort(function (left, right) {
      if (right.score !== left.score) return right.score - left.score;
      return right.discount - left.discount;
    });
    return {
      rows: rows,
      state: state,
      totalValue: totalValue,
      planned: planned,
      postTotal: postTotal,
      remaining: state.pool - planned,
    };
  }

  function allocationRowById(snapshot, id) {
    return snapshot.rows.find(function (row) {
      return row.a.id === id;
    });
  }

  function allocationSimulate(row, amount) {
    var add = Math.max(0, allocFinite(amount, 0));
    if (!row || row.c.price === null || row.c.price <= 0) return null;
    var addedQty = add / row.c.price;
    var qty = row.c.nq === null ? row.a.qty + addedQty : row.a.qty + addedQty;
    var cost = row.c.cost + add;
    var mean = qty > 0 ? cost / qty : row.c.pm;
    return {
      amount: add,
      addedQty: addedQty,
      qty: qty,
      cost: cost,
      pm: mean,
      changePct: row.c.pm > 0 ? ((mean - row.c.pm) / row.c.pm) * 100 : 0,
    };
  }

  function allocationSimulateAtPrice(cost, qty, amount, price) {
    if (price <= 0) return { cost: cost, qty: qty, pm: qty > 0 ? cost / qty : 0 };
    var newCost = cost + amount;
    var newQty = qty + amount / price;
    return {
      cost: newCost,
      qty: newQty,
      pm: newQty > 0 ? newCost / newQty : 0,
    };
  }

  function allocationSetPool(value) {
    var snap = allocationBuildSnapshot();
    snap.state.pool = allocClamp(allocFinite(value, snap.state.pool), 0, ALLOCATION_LAB_MAX_POOL);
    snap.state.scenario = "custom";
    allocationSave();
    renderAllocationLab();
  }

  function allocationSetMaxWeight(value) {
    var snap = allocationBuildSnapshot();
    snap.state.maxWeight = allocClamp(allocFinite(value, snap.state.maxWeight), 3, 60);
    snap.state.scenario = "custom";
    allocationSave();
    renderAllocationLab();
  }

  function allocationSetAmount(id, value) {
    var snap = allocationBuildSnapshot();
    var row = allocationRowById(snap, id);
    if (!row) return;
    var wanted = Math.max(0, allocFinite(value, 0));
    var otherPlanned = snap.planned - row.allocation;
    var availablePool = Math.max(0, snap.state.pool - otherPlanned);
    var allowed = Math.min(row.maxAllocation, availablePool);
    var applied = Math.min(wanted, allowed);
    if (applied > 0) snap.state.allocations[id] = applied;
    else delete snap.state.allocations[id];
    snap.state.scenario = "custom";
    allocationSave();
    if (wanted > allowed + 0.009 && typeof showToast === "function") {
      showToast("Importo limitato da liquidita o peso massimo impostato");
    }
    renderAllocationLab();
  }

  function allocationClearPlan() {
    var snap = allocationBuildSnapshot();
    snap.state.allocations = {};
    snap.state.scenario = "custom";
    allocationSave();
    renderAllocationLab();
    if (typeof showToast === "function") showToast("Piano di allocazione azzerato");
  }

  function allocationDistribute(rows, budget, allocations) {
    var remaining = Math.max(0, budget);
    var active = rows.slice();
    var guard = 0;
    while (remaining > 0.01 && active.length && guard < 40) {
      var share = remaining / active.length;
      var moved = 0;
      active = active.filter(function (row) {
        var existing = allocations[row.a.id] || 0;
        var room = Math.max(0, row.maxAllocation - existing);
        if (room <= 0.01) return false;
        var give = Math.min(room, share);
        allocations[row.a.id] = existing + give;
        remaining -= give;
        moved += give;
        return room - give > 0.01;
      });
      if (moved <= 0.01) break;
      guard++;
    }
    return remaining;
  }

  function allocationApplyScenario(kind) {
    var snap = allocationBuildSnapshot();
    var rows = snap.rows.slice();
    var etfs = rows.filter(function (row) {
      return row.t === "etf";
    });
    var cryptos = rows.filter(function (row) {
      return row.t === "crypto";
    });
    var allocations = {};
    var left = snap.state.pool;
    if (kind === "prudent") {
      etfs.sort(function (a, b) {
        return a.risk - b.risk || b.score - a.score;
      });
      left = allocationDistribute(etfs, left, allocations);
    } else if (kind === "balanced") {
      etfs.sort(function (a, b) {
        return b.score - a.score;
      });
      cryptos.sort(function (a, b) {
        return a.risk - b.risk || b.score - a.score;
      });
      left = allocationDistribute(etfs, snap.state.pool * 0.7, allocations);
      left += allocationDistribute(cryptos, snap.state.pool * 0.3, allocations);
    } else {
      etfs.sort(function (a, b) {
        return b.score - a.score || b.risk - a.risk;
      });
      cryptos.sort(function (a, b) {
        return b.score - a.score || b.risk - a.risk;
      });
      left = allocationDistribute(etfs, snap.state.pool * 0.45, allocations);
      left += allocationDistribute(cryptos, snap.state.pool * 0.55, allocations);
    }
    /* Prova a usare l'eventuale quota non allocata soltanto dove c'è ancora
       spazio entro il limite di concentrazione scelto dall'utente. */
    if (left > 0.01) {
      rows.sort(function (a, b) {
        return b.score - a.score;
      });
      allocationDistribute(rows, left, allocations);
    }
    snap.state.allocations = allocations;
    snap.state.scenario = kind;
    allocationSave();
    renderAllocationLab();
    if (typeof showToast === "function") {
      showToast("Scenario simulativo aggiornato: " + allocationScenarioLabel(kind));
    }
  }

  function allocationScenarioLabel(kind) {
    if (kind === "prudent") return "Prudente";
    if (kind === "balanced") return "Bilanciato";
    if (kind === "dynamic") return "Dinamico";
    return "Personalizzato";
  }

  function allocationSetGoalAsset(id) {
    var snap = allocationBuildSnapshot();
    if (!allocationRowById(snap, id)) return;
    snap.state.goalAsset = id;
    allocationSave();
    renderAllocationLab();
  }

  function allocationSetGoalCapital(value) {
    var snap = allocationBuildSnapshot();
    snap.state.goalCapital = allocClamp(allocFinite(value, snap.state.goalCapital), 0, ALLOCATION_LAB_MAX_POOL * 10);
    allocationSave();
    renderAllocationLab();
  }

  function allocationSetTimelineAsset(id) {
    var snap = allocationBuildSnapshot();
    if (!allocationRowById(snap, id)) return;
    snap.state.timelineAsset = id;
    allocationSave();
    renderAllocationLab();
  }

  function allocationSetTimelineAmount(value) {
    var snap = allocationBuildSnapshot();
    snap.state.timelineAmount = allocClamp(allocFinite(value, snap.state.timelineAmount), 0, ALLOCATION_LAB_MAX_POOL);
    allocationSave();
    renderAllocationLab();
  }

  function allocationSetTranches(value) {
    var snap = allocationBuildSnapshot();
    var count = Number(value);
    if ([3, 4, 6].indexOf(count) >= 0) snap.state.tranches = count;
    allocationSave();
    renderAllocationLab();
  }

  function allocationSelectAsset(id) {
    var snap = allocationBuildSnapshot();
    if (!allocationRowById(snap, id)) return;
    snap.state.goalAsset = id;
    snap.state.timelineAsset = id;
    allocationSave();
    renderAllocationLab();
    if (typeof showToast === "function") showToast("Asset selezionato per obiettivo e piano ingressi");
  }

  function allocationOptions(rows, selected) {
    return rows
      .map(function (row) {
        return (
          '<option value="' +
          allocEscape(row.a.id) +
          '"' +
          (row.a.id === selected ? " selected" : "") +
          ">" +
          allocEscape(row.a.name) +
          " · " +
          (row.t === "crypto" ? "Crypto" : "ETF") +
          "</option>"
        );
      })
      .join("");
  }

  function allocationDonutStyle(snapshot) {
    var groups = {
      crypto: { value: 0, color: "#a78bfa", label: "Crypto" },
      etf: { value: 0, color: "#38d9ff", label: "ETF" },
      fondi: { value: 0, color: "#f0c040", label: "Fondi" },
    };
    snapshot.rows.forEach(function (row) {
      groups[row.t].value += row.value + row.allocation;
    });
    var total = snapshot.postTotal;
    var cursor = 0;
    var parts = [];
    Object.keys(groups).forEach(function (type) {
      var pct = total > 0 ? (groups[type].value / total) * 100 : 0;
      if (pct <= 0) return;
      parts.push(groups[type].color + " " + cursor.toFixed(2) + "% " + (cursor + pct).toFixed(2) + "%");
      cursor += pct;
    });
    return {
      css: "conic-gradient(" + (parts.length ? parts.join(",") : "#202534 0 100%") + ")",
      groups: groups,
    };
  }

  function allocationConcentration(snapshot) {
    return snapshot.rows
      .slice()
      .sort(function (a, b) {
        return b.postWeight - a.postWeight;
      })
      .slice(0, 7)
      .map(function (row) {
        var ratio = row.postWeight / snapshot.state.maxWeight;
        var tone = ratio > 1 ? "risk" : ratio > 0.75 ? "warn" : "good";
        var label = ratio > 1 ? "oltre" : ratio > 0.75 ? "attenzione" : "ok";
        return (
          '<div class="alloc-conc-row"><span class="alloc-conc-name" title="' +
          allocEscape(row.a.name) +
          '">' +
          allocEscape(row.a.name) +
          '</span><div class="alloc-conc-track"><div class="alloc-conc-fill ' +
          tone +
          '" style="width:' +
          allocClamp(ratio * 100, 0, 100).toFixed(1) +
          '%"></div></div><span class="alloc-conc-state ' +
          (tone === "risk" ? "r" : tone === "warn" ? "y" : "g") +
          '">' +
          allocPlain(row.postWeight, 1) +
          "% · " +
          label +
          "</span></div>"
        );
      })
      .join("");
  }

  function allocationMapRows(snapshot) {
    return snapshot.rows
      .map(function (row) {
        var simulation = allocationSimulate(row, row.allocation);
        var pmChange = simulation ? simulation.changePct : null;
        var quote = JSON.stringify(row.a.id).replace(/\"/g, "&quot;");
        var maxAmount = Math.max(row.allocation, Math.min(snapshot.state.pool, row.maxAllocation));
        var rangeDisabled = maxAmount <= 0.001 ? " disabled" : "";
        var scoreMeta =
          "P.M. " +
          (row.discount >= 0 ? "-" : "+") +
          allocPlain(Math.abs(row.discount), 1) +
          "% · rischio " +
          row.risk +
          "/100";
        var pmText =
          pmChange === null
            ? '<span class="mu">—</span>'
            : '<span class="' +
              (pmChange < 0 ? "g" : pmChange > 0 ? "r" : "mu") +
              '">' +
              (pmChange <= 0 ? "↓ " : "↑ ") +
              allocPlain(pmChange, 2) +
              "%</span>";
        return (
          '<div class="alloc-row">' +
          '<div class="alloc-asset-name"><span class="alloc-type ' +
          (row.t === "crypto" ? "crypto" : "") +
          '">' +
          (row.t === "crypto" ? "Crypto" : "ETF") +
          "</span><b title=\"" +
          allocEscape(row.a.name) +
          "\">" +
          allocEscape(row.a.name) +
          "</b></div>" +
          '<div><div class="alloc-score"><strong>' +
          row.score +
          "</strong><span>/100</span></div><small>" +
          scoreMeta +
          "</small></div>" +
          '<div class="alloc-metric"><span class="' +
          (row.discount > 0 ? "g" : row.discount < 0 ? "r" : "mu") +
          '">' +
          (row.discount > 0 ? "↓ " : row.discount < 0 ? "↑ " : "") +
          allocPlain(Math.abs(row.discount), 2) +
          "%</span><small>dist. dal P.M. · spazio " +
          allocPlain(row.maxAllocation, 0) +
          " €</small></div>" +
          '<div class="alloc-metric">' +
          allocPlain(row.weight, 1) +
          "% → <strong>" +
          allocPlain(row.postWeight, 1) +
          "%</strong><small>P.M. simulato: " +
          pmText +
          "</small></div>" +
          '<div class="alloc-plan-control"><input class="alloc-input" aria-label="Piano per ' +
          allocEscape(row.a.name) +
          '" type="number" min="0" max="' +
          maxAmount.toFixed(2) +
          '" step="25" value="' +
          row.allocation.toFixed(2) +
          '" onchange="allocationSetAmount(' +
          quote +
          ', this.value)"><input class="alloc-range" type="range" min="0" max="' +
          maxAmount.toFixed(2) +
          '" step="25" value="' +
          Math.min(row.allocation, maxAmount).toFixed(2) +
          '" onchange="allocationSetAmount(' +
          quote +
          ', this.value)"' +
          rangeDisabled +
          "></div>" +
          '<div class="alloc-plan-note">Budget virtuale: non modifica la posizione reale.</div>' +
          "</div>"
        );
      })
      .join("");
  }

  function allocationMatrixBubbles(snapshot) {
    return snapshot.rows
      .map(function (row) {
        var x = allocClamp(Math.max(0, row.discount) / 42, 0.04, 0.96) * 100;
        var y = allocClamp((100 - row.risk) / 100, 0.08, 0.9) * 100;
        var size = allocClamp(28 + Math.sqrt(Math.max(0, row.weight)) * 9, 34, 68);
        var color = row.t === "crypto" ? "#a78bfa" : row.risk >= 78 ? "#f0c040" : "#38d9ff";
        return (
          '<button type="button" class="alloc-bubble" style="--x:' +
          x.toFixed(2) +
          "%;--y:" +
          y.toFixed(2) +
          "%;--size:" +
          size.toFixed(0) +
          "px;--bubble:" +
          color +
          '" title="' +
          allocEscape(row.a.name) +
          " · scostamento dal P.M. " +
          allocPlain(row.discount, 1) +
          "% · rischio " +
          row.risk +
          '/100" onclick="allocationSelectAsset(' +
          JSON.stringify(row.a.id).replace(/\"/g, "&quot;") +
          ')"><span>' +
          allocEscape(row.a.name.slice(0, 10)) +
          "</span></button>"
        );
      })
      .join("");
  }

  function allocationGoalHtml(snapshot) {
    var row = allocationRowById(snapshot, snapshot.state.goalAsset);
    if (!row) return '<p class="alloc-disclaimer">Nessun asset con prezzo disponibile.</p>';
    var missing = Math.max(0, snapshot.state.goalCapital - row.c.cost);
    var sim = allocationSimulate(row, missing);
    return (
      '<div class="alloc-goal-grid"><select class="alloc-select" onchange="allocationSetGoalAsset(this.value)">' +
      allocationOptions(snapshot.rows, row.a.id) +
      '</select><input class="alloc-input" type="number" min="0" step="100" value="' +
      snapshot.state.goalCapital.toFixed(2) +
      '" aria-label="Obiettivo capitale investito" onchange="allocationSetGoalCapital(this.value)"></div>' +
      '<div class="alloc-goal-results">' +
      '<div class="alloc-result-row"><span>Capitale storico attuale</span><strong>' +
      allocMoney(row.c.cost, 2) +
      "</strong></div>" +
      '<div class="alloc-result-row"><span>Da simulare per l’obiettivo</span><strong class="' +
      (missing > 0 ? "y" : "g") +
      '">' +
      allocMoney(missing, 2) +
      "</strong></div>" +
      '<div class="alloc-result-row"><span>Nuovo P.M. al prezzo corrente</span><strong>' +
      (sim ? allocMoney(sim.pm, 3) : "—") +
      "</strong></div>" +
      '<div class="alloc-result-row"><span>Variazione P.M.</span><strong class="' +
      (sim && sim.changePct < 0 ? "g" : "mu") +
      '">' +
      (sim ? (sim.changePct < 0 ? "↓ " : "") + allocPercent(sim.changePct, 2) : "—") +
      "</strong></div>" +
      "</div>"
    );
  }

  function allocationTimelineHtml(snapshot) {
    var row = allocationRowById(snapshot, snapshot.state.timelineAsset);
    if (!row) return '<p class="alloc-disclaimer">Nessun asset con prezzo disponibile.</p>';
    var count = snapshot.state.tranches;
    var multipliers = {
      3: [1, 0.95, 0.9],
      4: [1, 0.96, 0.92, 0.88],
      6: [1, 0.97, 0.94, 0.91, 0.88, 0.85],
    }[count];
    var tranche = snapshot.state.timelineAmount / count;
    var rollingCost = row.c.cost;
    var rollingQty = row.a.qty;
    var rows = multipliers
      .map(function (multiplier, index) {
        var assumedPrice = row.c.price * multiplier;
        var next = allocationSimulateAtPrice(rollingCost, rollingQty, tranche, assumedPrice);
        rollingCost = next.cost;
        rollingQty = next.qty;
        return (
          '<div class="alloc-tranche"><span class="alloc-tranche-label">Step ' +
          (index + 1) +
          "/" +
          count +
          "</span><span>" +
          allocMoney(tranche, 2) +
          " a " +
          allocMoney(assumedPrice, 3) +
          "</span><strong>P.M. " +
          allocMoney(next.pm, 3) +
          "</strong></div>"
        );
      })
      .join("");
    return (
      '<div class="alloc-timeline-head"><select class="alloc-select" onchange="allocationSetTimelineAsset(this.value)">' +
      allocationOptions(snapshot.rows, row.a.id) +
      '</select><input class="alloc-input" style="max-width:132px" type="number" min="0" step="100" value="' +
      snapshot.state.timelineAmount.toFixed(2) +
      '" aria-label="Importo piano a tranche" onchange="allocationSetTimelineAmount(this.value)"><select class="alloc-select" style="max-width:95px" onchange="allocationSetTranches(this.value)">' +
      [3, 4, 6]
        .map(function (value) {
          return '<option value="' + value + '"' + (value === count ? " selected" : "") + ">" + value + " step</option>";
        })
        .join("") +
      "</select></div>" +
      '<div class="alloc-timeline">' +
      rows +
      "</div>" +
      '<p class="alloc-disclaimer">I livelli -5%, -10% ecc. sono soltanto una griglia di disciplina per visualizzare l’effetto sul P.M.; non sono previsioni di prezzo né ordini automatici.</p>'
    );
  }

  function renderAllocationLab(portfolio) {
    var el = document.getElementById("sec-allocation");
    if (!el) return;
    var snapshot = allocationBuildSnapshot(portfolio || P);
    var state = snapshot.state;
    var donut = allocationDonutStyle(snapshot);
    var planTone = snapshot.remaining < -0.01 ? "risk" : snapshot.remaining < state.pool * 0.1 ? "warn" : "";
    var plannedMix = ["crypto", "etf", "fondi"]
      .filter(function (type) {
        return donut.groups[type].value > 0;
      })
      .map(function (type) {
        var group = donut.groups[type];
        var pct = snapshot.postTotal > 0 ? (group.value / snapshot.postTotal) * 100 : 0;
        return (
          '<div class="alloc-legend-row"><span class="alloc-dot" style="background:' +
          group.color +
          '"></span><span>' +
          group.label +
          "</span><strong>" +
          allocPlain(pct, 1) +
          "%</strong></div>"
        );
      })
      .join("");
    el.innerHTML =
      '<div class="alloc-wrap">' +
      '<div class="alloc-hero">' +
      '<section class="alloc-panel alloc-hero-main"><div class="alloc-eyebrow">Decision support · simulazione locale</div><h1 class="alloc-title">Allocation Lab</h1>' +
      '<p class="alloc-copy">Trasforma la liquidità in un piano leggibile: considera prezzo attuale, distanza dal P.M., peso già in portafoglio e limite di concentrazione scelto da te. La console non acquista, non modifica il portfolio e non fa previsioni.</p>' +
      '<div class="alloc-note"><span>ⓘ</span><span>Gli score sono una regola trasparente di disciplina, non una raccomandazione finanziaria. Il risultato resta una simulazione da verificare con il tuo piano, rischio e orizzonte.</span></div></section>' +
      '<section class="alloc-panel"><div class="alloc-eyebrow">Impostazioni del piano</div><div class="alloc-control-grid">' +
      '<label class="alloc-field"><span class="alloc-label">Liquidità da simulare<small>Non aggiorna il Budget e resta indipendente dal What‑If principale.</small></span><input class="alloc-input" type="number" min="0" step="50" value="' +
      state.pool.toFixed(2) +
      '" onchange="allocationSetPool(this.value)"></label>' +
      '<label class="alloc-field"><span class="alloc-label">Limite per singola posizione<small>Usato come semaforo e come tetto del piano simulato.</small></span><input class="alloc-input" type="number" min="3" max="60" step="1" value="' +
      state.maxWeight.toFixed(0) +
      '" onchange="allocationSetMaxWeight(this.value)"></label>' +
      '</div><div class="alloc-actions"><button class="alloc-btn ' +
      (state.scenario === "prudent" ? "active" : "") +
      '" type="button" onclick="allocationApplyScenario(\'prudent\')">Prudente</button><button class="alloc-btn ' +
      (state.scenario === "balanced" ? "active" : "") +
      '" type="button" onclick="allocationApplyScenario(\'balanced\')">Bilanciato</button><button class="alloc-btn ' +
      (state.scenario === "dynamic" ? "active" : "") +
      '" type="button" onclick="allocationApplyScenario(\'dynamic\')">Dinamico</button><button class="alloc-btn secondary" type="button" onclick="allocationClearPlan()">Azzera piano</button></div>' +
      '<div class="alloc-chips"><span class="alloc-chip">Scenario: ' +
      allocationScenarioLabel(state.scenario) +
      '</span><span class="alloc-chip">Dati dal portfolio attuale</span></div></section></div>' +
      '<div class="alloc-kpis">' +
      '<div class="alloc-kpi"><span class="alloc-label">Liquidità simulata</span><strong>' +
      allocMoney(state.pool, 2) +
      '</strong><small>Input modificabile</small></div>' +
      '<div class="alloc-kpi"><span class="alloc-label">Piano distribuito</span><strong class="' +
      (snapshot.planned > 0 ? "g" : "mu") +
      '">' +
      allocMoney(snapshot.planned, 2) +
      '</strong><small>Su ' +
      snapshot.rows.filter(function (row) { return row.allocation > 0; }).length +
      " posizioni</small></div>" +
      '<div class="alloc-kpi ' +
      planTone +
      '"><span class="alloc-label">Residuo non allocato</span><strong class="' +
      (snapshot.remaining < 0 ? "r" : snapshot.remaining > 0 ? "y" : "g") +
      '">' +
      allocMoney(snapshot.remaining, 2) +
      '</strong><small>' +
      (snapshot.remaining < 0 ? "Piano oltre liquidità" : "Resta disponibile") +
      "</small></div>" +
      '<div class="alloc-kpi"><span class="alloc-label">Limite concentrazione</span><strong>' +
      allocPercent(state.maxWeight, 0) +
      '</strong><small>Sul valore post-piano</small></div></div>' +
      '<div class="alloc-grid"><section class="alloc-card"><h2>Mappa dove distribuire la liquidità</h2><p class="alloc-card-sub">Score = sconto dal P.M. (max 38) + spazio sotto il limite (max 25) + ruolo nel mix (max 18) + intensità di rischio (max 12). Modifica liberamente ogni importo.</p><div class="alloc-map"><div class="alloc-map-head"><span>Asset</span><span>Score</span><span>Distanza / spazio</span><span>Peso / P.M.</span><span>Piano €</span></div>' +
      allocationMapRows(snapshot) +
      "</div></section>" +
      '<aside class="alloc-card"><h2>Mix dopo il piano</h2><p class="alloc-card-sub">La torta riflette solo gli importi simulati, non sposta davvero le posizioni.</p><div class="alloc-composition"><div class="alloc-donut" style="--alloc-donut:' +
      donut.css +
      '"></div><div class="alloc-legend">' +
      plannedMix +
      '</div></div><div style="height:18px"></div><h3>Semaforo di concentrazione</h3><p class="alloc-card-sub">Verde ≤ 75% del limite, giallo in avvicinamento, rosso oltre.</p><div class="alloc-concentration">' +
      allocationConcentration(snapshot) +
      "</div></aside></div>" +
      '<div class="alloc-bottom-grid"><section class="alloc-card"><h2>Matrice opportunità × rischio</h2><p class="alloc-card-sub">Destra = maggiore distanza sotto il P.M.; alto = intensità di rischio più elevata. La dimensione della bolla segue il peso attuale. Seleziona una bolla per usarla sotto.</p><div class="alloc-matrix"><span class="alloc-matrix-y">Rischio indicativo ↑</span><span class="alloc-matrix-x">Sconto dal P.M. →</span>' +
      allocationMatrixBubbles(snapshot) +
      "</div></section>" +
      '<section class="alloc-card"><h2>Obiettivo di posizione</h2><p class="alloc-card-sub">Quanto capitale storico vorresti simulare su una posizione, senza applicarlo.</p>' +
      allocationGoalHtml(snapshot) +
      '<div style="height:20px"></div><h2>Piano a tranche</h2><p class="alloc-card-sub">Confronta l’effetto di ingressi ripartiti sul P.M. con prezzi ipotetici in discesa.</p>' +
      allocationTimelineHtml(snapshot) +
      "</section></div>" +
      '<p class="alloc-disclaimer">Allocation Lab usa esclusivamente i dati già presenti in WIPS. Non altera posizioni, prezzi, CSV, backup, Kraken, Budget, Advisor o il What‑If globale. I valori evidenziati sono copiabili con un click, come nelle tabelle.</p>' +
      "</div>";
  }

  /* API globale minima: usata dai controlli HTML e tenuta separata dal core. */
  window.renderAllocationLab = renderAllocationLab;
  window.allocationSetPool = allocationSetPool;
  window.allocationSetMaxWeight = allocationSetMaxWeight;
  window.allocationSetAmount = allocationSetAmount;
  window.allocationClearPlan = allocationClearPlan;
  window.allocationApplyScenario = allocationApplyScenario;
  window.allocationSetGoalAsset = allocationSetGoalAsset;
  window.allocationSetGoalCapital = allocationSetGoalCapital;
  window.allocationSetTimelineAsset = allocationSetTimelineAsset;
  window.allocationSetTimelineAmount = allocationSetTimelineAmount;
  window.allocationSetTranches = allocationSetTranches;
  window.allocationSelectAsset = allocationSelectAsset;
})();
