"""
data/generate_data.py — synthetic well incident generator for WELL X.

Usage:
    python generate_data.py            # writes 60 wells to wells_data.json
    python generate_data.py --n 100

Deterministic: same output every run (seeded RNG).
Output schema matches what backend/seed_data.py consumes.
"""

import argparse
import json
import random
from collections import Counter
from datetime import date, timedelta
from pathlib import Path

OUT_PATH = Path(__file__).resolve().parent / "wells_data.json"

# ---------------------------------------------------------------------------
# Geography — local Assam clusters + far basins (the far ones exist so the
# geo-weighting has correct distractors to suppress).
# ---------------------------------------------------------------------------
CLUSTERS = [
    {"name": "North Bank Field",    "lat": 27.45, "lon": 95.20, "jitter": 0.12, "weight": 0.20},
    {"name": "Central Assam Field", "lat": 27.33, "lon": 95.10, "jitter": 0.12, "weight": 0.20},
    {"name": "South Field",         "lat": 27.52, "lon": 95.06, "jitter": 0.10, "weight": 0.15},
    {"name": "Cachar Front",        "lat": 24.85, "lon": 92.90, "jitter": 0.15, "weight": 0.12},
    {"name": "Tripura Fold Belt",   "lat": 23.60, "lon": 91.60, "jitter": 0.15, "weight": 0.10},
    {"name": "Western Desert Field","lat": 27.05, "lon": 71.50, "jitter": 0.25, "weight": 0.15},
    {"name": "Offshore Bay Block",  "lat": 16.90, "lon": 82.40, "jitter": 0.20, "weight": 0.08, "offshore": True},
]

# ---------------------------------------------------------------------------
# Incident archetypes. Each well picks: opening + body + resolution +
# recommendation fragment, with randomized numbers. depth/formation are
# injected as {depth}/{formation}; numbers come from each archetype's
# numbers() function.
# ---------------------------------------------------------------------------
ARCHETYPES = [
    {
        "incident_type": "Stuck Pipe",  # differential, depleted sand
        "formations": ["Depleted Sandstone", "Barail Sandstone", "Gas-Bearing Sand"],
        "depth": (2200, 3400),
        "severities": ["high", "high", "medium"],
        "offshore_only": False,
        "numbers": lambda rng: {
            "stationary": rng.randint(15, 60),
            "overbalance": rng.randint(25, 60),
            "overpull": rng.choice([80, 100, 120]),
            "mw": round(rng.uniform(1.22, 1.38), 2),
            "days": rng.randint(2, 6),
        },
        "openings": [
            "While drilling ahead at {depth} m in the {formation} section, the drill string became stuck after {stationary} minutes without rotation.",
            "The pipe became differentially stuck at {depth} m when circulation was stopped for a connection across the {formation}.",
            "At {depth} m, drag increased sharply before the string stuck firm against the {formation} while picking up after a survey.",
        ],
        "bodies": [
            "Mud overbalance against the depleted interval was estimated at {overbalance} bar, and the string could not be moved even with {overpull} tonnes of overpull.",
            "With {mw} SG mud in the hole, the pressure overbalance against the depleted sand was close to {overbalance} bar and no downward movement was possible.",
        ],
        "resolutions": [
            "The string was freed after {days} days of spotting-fluid soaks and repeated jarring, with no pipe left in hole.",
            "A back-off was required; the free point was found and the lower assembly fished over {days} days.",
        ],
        "recommendations": [
            "Recommend reducing mud weight toward the minimum safe window and minimising stationary time across depleted sands.",
            "Recommend pumping a spotting-fluid pill before any planned stop below {depth} m and closely tracking overpull trends.",
        ],
    },
    {
        "incident_type": "Stuck Pipe",  # pack-off, poor hole cleaning in clay
        "formations": ["Girujan Clay", "Bokabil Shale"],
        "depth": (1000, 2200),
        "severities": ["low", "medium", "medium"],
        "offshore_only": False,
        "numbers": lambda rng: {
            "rop": rng.randint(28, 45),
            "pdrop": rng.randint(20, 60),
            "hours": rng.randint(3, 10),
        },
        "openings": [
            "Stuck pipe occurred at {depth} m while making a connection after a fast drilling run through soft {formation}.",
            "The string packed off at {depth} m with standpipe pressure falling by {pdrop} bar and torque spiking on the pick-up.",
        ],
        "bodies": [
            "Cuttings returns had thinned out over the previous stands while ROP averaged {rop} m/hr, pointing to poor hole cleaning and cuttings accumulation in the {formation}.",
            "Hole cleaning was inadequate for the {formation}, with ROP of {rop} m/hr and low annular velocity in the enlarged section.",
        ],
        "resolutions": [
            "The pipe was worked free after {hours} hours of jarring and a high-viscosity sweep, with no equipment damage.",
            "Back-reaming and circulating for {hours} hours cleared the pack-off and the string came free.",
        ],
        "recommendations": [
            "Recommend circulating bottoms-up on every connection and limiting ROP below 25 m/hr through clay sections.",
            "Recommend frequent short trips and high-viscosity sweeps when penetration rates exceed {rop} m/hr in reactive clay.",
        ],
    },
    {
        "incident_type": "Stuck Pipe",  # mechanical / keyseat
        "formations": ["Tipam Sandstone", "Bokabil Shale", "Barail Sandstone"],
        "depth": (1500, 3000),
        "severities": ["low", "medium", "medium"],
        "offshore_only": False,
        "numbers": lambda rng: {
            "overpull": rng.choice([70, 90, 110, 130]),
            "dogleg": round(rng.uniform(2.5, 5.0), 1),
            "days": rng.randint(1, 4),
        },
        "openings": [
            "The drill string became stuck at {depth} m while pulling out of hole through the {formation} section.",
            "While tripping out at {depth} m, the string stalled in a suspected keyseat below the {formation} casing shoe.",
        ],
        "bodies": [
            "Upward pull reached {overpull} tonnes with free rotation and full circulation, and the survey showed a dogleg severity of {dogleg} degrees per 30 m just above the stuck point.",
            "The stuck point was shallow in the open hole where a directional survey recorded {dogleg} deg/30 m, indicating a keyseat groove rather than differential sticking.",
        ],
        "resolutions": [
            "The string was freed by working pipe and reaming through the keyseat over {days} days.",
            "A washover assembly freed the string in {days} days with minor BHA damage.",
        ],
        "recommendations": [
            "Recommend reaming suspected dogleg intervals on every trip and tracking torque and drag trends against offset wells.",
            "Recommend limiting tripping speed through build sections and reviewing BHA stiffness in high-dogleg wells.",
        ],
    },
    {
        "incident_type": "Lost Circulation",  # fractured carbonate
        "formations": ["Fractured Limestone"],
        "depth": (1600, 2900),
        "severities": ["medium", "high", "medium"],
        "offshore_only": False,
        "numbers": lambda rng: {
            "gain": rng.randint(6, 18),
            "hours": rng.randint(1, 6),
            "days": rng.randint(1, 4),
        },
        "openings": [
            "Total mud losses were observed at {depth} m while drilling through the fractured {formation} sequence.",
            "Partial losses began at {depth} m in the {formation} and progressed to total losses within {hours} hours.",
        ],
        "bodies": [
            "Returns dropped to zero and pit volume fell by {gain} cubic metres as the loss zone opened up in the fractured {formation}.",
            "Flowline returns ceased completely with a pit loss of {gain} cubic metres, consistent with a natural fracture network in the {formation}.",
        ],
        "resolutions": [
            "Managed with an LCM pill and reduced circulation rate, then secured with a cement squeeze over {days} days.",
            "A high-viscosity LCM slug regained partial returns and a cement squeeze sealed the zone after {days} days of remediation.",
        ],
        "recommendations": [
            "Recommend pre-staging loss-circulation material and a cement squeeze contingency before entering carbonate sections near {depth} m.",
            "Recommend monitoring pit volume closely and holding a dedicated LCM inventory when drilling the fractured carbonate in this field.",
        ],
    },
    {
        "incident_type": "Lost Circulation",  # shallow gravel
        "formations": ["Alluvial Gravel Beds"],
        "depth": (300, 900),
        "severities": ["low"],
        "offshore_only": False,
        "numbers": lambda rng: {
            "rate": rng.randint(2, 6),
            "hours": rng.randint(18, 40),
        },
        "openings": [
            "Partial mud losses were first observed at {depth} m in the boulder and gravel beds of the shallow {formation}.",
            "While drilling the shallow {formation}, losses reached {rate} cubic metres per hour at {depth} m.",
        ],
        "bodies": [
            "Losses climbed to {rate} cubic metres per hour with returns noticeably reduced at the flowline.",
            "The shallow sequence took fluid at {rate} cubic metres per hour without any change in drilling parameters.",
        ],
        "resolutions": [
            "Two LCM pills of walnut shells and calcium carbonate reduced losses, followed by a soft cement squeeze; drilling resumed after {hours} hours.",
            "Losses were controlled with a graded-salt LCM treatment after {hours} hours and returns returned to near full.",
        ],
        "recommendations": [
            "Recommend pre-staging LCM before drilling the shallow gravel sequence and monitoring the active pit closely.",
            "Recommend maintaining adequate kill margin and expecting losses of several cubic metres per hour in the boulder beds.",
        ],
    },
    {
        "incident_type": "Gas Kick",
        "formations": ["Gas-Bearing Sand", "Barail Sandstone"],
        "depth": (2400, 3400),
        "severities": ["high", "high", "medium"],
        "offshore_only": False,
        "numbers": lambda rng: {
            "gain": round(rng.uniform(0.8, 3.0), 1),
            "p1": rng.randint(35, 50),
            "p2": rng.randint(80, 120),
            "hours": rng.randint(4, 9),
            "stop": rng.randint(20, 40),
        },
        "openings": [
            "A gas kick was detected at {depth} m in a thin sand within the {formation} after a {stop}-minute connection stoppage.",
            "While making a connection at {depth} m in the {formation}, flow was observed at the flowline with the pumps off.",
        ],
        "bodies": [
            "Pit gain of {gain} cubic metres and casing pressure rising from {p1} to {p2} bar confirmed an influx from the overpressured sand.",
            "The flow check showed a {gain} cubic metre pit gain and shut-in casing pressure of {p2} bar, indicating a live kick.",
        ],
        "resolutions": [
            "The well was shut in and killed using the wait-and-weight method within {hours} hours.",
            "The influx was circulated out over {hours} hours using the driller's method with no further problems.",
        ],
        "recommendations": [
            "Recommend increasing mud weight margin and monitoring flowback closely below {depth} m in this field.",
            "Recommend a flow check after every connection and pre-rigging the diverter when approaching thin gas sands near {depth} m.",
        ],
    },
    {
        "incident_type": "Wellbore Instability",
        "formations": ["Bokabil Shale", "Carbonaceous Shale"],
        "depth": (2000, 3100),
        "severities": ["high", "high", "medium"],
        "offshore_only": False,
        "numbers": lambda rng: {
            "t1": rng.randint(15, 20),
            "t2": rng.randint(26, 34),
            "cal": rng.choice([14, 15, 16, 18]),
            "mw1": round(rng.uniform(1.12, 1.18), 2),
            "mw2": round(rng.uniform(1.22, 1.30), 2),
            "days": rng.randint(3, 6),
        },
        "openings": [
            "While drilling the {formation} section at {depth} m, torque climbed progressively from {t1} to {t2} kilonewton-metres and the hole began to pack off on each connection.",
            "Hole instability developed at {depth} m in the {formation}, with large angular cavings appearing at the shaker.",
        ],
        "bodies": [
            "Cuttings returns contained abundant angular shale cavings and the caliper log later showed enlargement from 12 to {cal} inches across the interval.",
            "Repeated pack-off events and rising drag indicated a swelling {formation}, confirmed by {cal}-inch caliper enlargement over the open hole.",
        ],
        "resolutions": [
            "The interval required repeated reaming, raising mud weight from {mw1} to {mw2} SG and switching to an inhibitive mud system, taking {days} days.",
            "Stabilisation took {days} days of reaming and a mud programme change to an inhibitive KCl-polymer system at {mw2} SG.",
        ],
        "recommendations": [
            "Recommend pre-emptive mud weight increase and cavings-volume monitoring when entering the {formation} below {depth} m.",
            "Recommend drilling the {formation} in one bit run with an inhibitive mud and avoiding long static periods.",
        ],
    },
    {
        "incident_type": "H2S Gas Show",
        "formations": ["Carbonaceous Shale"],
        "depth": (2500, 3200),
        "severities": ["high", "medium", "high"],
        "offshore_only": False,
        "numbers": lambda rng: {
            "ppm": rng.randint(8, 30),
            "hours": rng.randint(2, 5),
            "mw1": round(rng.uniform(1.18, 1.24), 2),
            "mw2": round(rng.uniform(1.26, 1.32), 2),
        },
        "openings": [
            "Hydrogen sulphide was detected at the shaker at {ppm} ppm while coring at {depth} m in sand interbeds of the {formation}.",
            "While drilling the {formation} at {depth} m, H2S detectors alarmed at {ppm} ppm near the shale shaker.",
        ],
        "bodies": [
            "Operations were paused, breathing apparatus donned, and scavenger added to the mud as a precaution.",
            "All non-essential personnel moved upwind, the annulus was monitored and a triazine scavenger was pumped continuously.",
        ],
        "resolutions": [
            "H2S levels returned to zero within {hours} hours after mud density was raised from {mw1} to {mw2} SG, with no exposure or flare events.",
            "The zone was controlled within {hours} hours and drilling resumed with continuous scavenger treatment.",
        ],
        "recommendations": [
            "Recommend full H2S personal monitoring and breathing apparatus rigged up before coring below {depth} m in this area.",
            "Recommend holding a scavenger inventory and testing the H2S contingency plan before entering carbonaceous intervals near {depth} m.",
        ],
    },
    {
        "incident_type": "Drill String Washout",
        "formations": ["Tipam Sandstone", "Barail Sandstone", "Gas-Bearing Sand"],
        "depth": (1400, 2900),
        "severities": ["medium", "low", "medium"],
        "offshore_only": False,
        "numbers": lambda rng: {
            "p1": rng.randint(180, 200),
            "p2": rng.randint(130, 160),
            "hours": rng.randint(24, 48),
        },
        "openings": [
            "Pump pressure dropped suddenly from {p1} to {p2} bar while drilling {formation} at {depth} m, indicating a washout in the drill string.",
            "At {depth} m in the {formation}, standpipe pressure fell from {p1} to {p2} bar with no change in parameters, suggesting a string leak.",
        ],
        "bodies": [
            "The string was pulled and a twisted-off drill collar was recovered by fishing in two runs, totalling {hours} hours of downtime.",
            "A washout was confirmed at a worn tool joint; the string was pulled and the damaged joint replaced after {hours} hours.",
        ],
        "resolutions": [
            "Drilling resumed after pressure-testing the reassembled string with no further losses.",
            "Fishing recovered the full assembly and drilling resumed following a pressure test of the string.",
        ],
        "recommendations": [
            "Recommend regular drill-collar inspection and tracking standpipe pressure trends to catch gradual washouts before a twist-off.",
            "Recommend limiting rotating hours on critical drill collar connections and inspecting tool joints in this field.",
        ],
    },
    {
        "incident_type": "Shallow Water Flow",
        "formations": ["Shallow Aquifer Sand"],
        "depth": (250, 700),
        "severities": ["medium"],
        "offshore_only": True,
        "numbers": lambda rng: {
            "gain": round(rng.uniform(0.4, 1.2), 1),
            "hours": rng.randint(4, 8),
            "mw1": round(rng.uniform(1.03, 1.08), 2),
            "mw2": round(rng.uniform(1.11, 1.16), 2),
        },
        "openings": [
            "While drilling the surface hole at {depth} m below seabed, a shallow water flow was observed with fluid bubbling at the seabed.",
            "A shallow water flow developed at {depth} m in the {formation} with a small pit gain of {gain} cubic metres.",
        ],
        "bodies": [
            "The well was shut in and flow-checked, and mud weight was raised from {mw1} to {mw2} SG to overbalance the shallow aquifer, with the diverter rigged up as a precaution.",
            "Return flow continued with pumps off; density was increased to {mw2} SG and the diverter line was kept open while monitoring seabed activity.",
        ],
        "resolutions": [
            "Flow stopped after {hours} hours and operations resumed with full returns.",
            "The aquifer was controlled after {hours} hours and casing was set to isolate the zone.",
        ],
        "recommendations": [
            "Recommend anticipating shallow water flow zones from seismic analysis before drilling surface hole in this block.",
            "Recommend pre-rigging the diverter and holding extra barite when drilling shallow aquifer sands near {depth} m.",
        ],
    },
]


def pick_cluster(rng: random.Random, offshore_only: bool) -> dict:
    if offshore_only:
        return next(c for c in CLUSTERS if c.get("offshore"))
    return rng.choices(CLUSTERS, weights=[c["weight"] for c in CLUSTERS])[0]


def make_well(idx: int, arch: dict, rng: random.Random) -> dict:
    cluster = pick_cluster(rng, arch["offshore_only"])
    inc_depth = rng.randint(*arch["depth"])
    formation = rng.choice(arch["formations"])

    ctx = {"depth": f"{inc_depth:,}", "formation": formation, **arch["numbers"](rng)}
    narrative = " ".join([
        rng.choice(arch["openings"]).format(**ctx),
        rng.choice(arch["bodies"]).format(**ctx),
        rng.choice(arch["resolutions"]).format(**ctx),
        rng.choice(arch["recommendations"]).format(**ctx),
    ])

    incident_date = date(2017, 1, 1) + timedelta(days=rng.randint(0, 2700))

    return {
        "well_name": f"WELL-SYN-{idx:03d}",
        "field_name": cluster["name"],
        "latitude": round(cluster["lat"] + rng.uniform(-cluster["jitter"], cluster["jitter"]), 4),
        "longitude": round(cluster["lon"] + rng.uniform(-cluster["jitter"], cluster["jitter"]), 4),
        "depth_start_m": max(150, inc_depth - rng.randint(400, 1400)),
        "depth_end_m": inc_depth + rng.randint(300, 1200),
        "incident_depth_m": inc_depth,
        "formation_type": formation,
        "incident_type": arch["incident_type"],
        "severity": rng.choice(arch["severities"]),
        "incident_date": incident_date.isoformat(),
        "narrative": narrative,
    }


def main(n: int):
    rng = random.Random(42)  # deterministic output every run
    # Cycle archetypes so every incident type gets equal representation —
    # guarantees /check_risk has a local match for any live drilling state.
    wells = [make_well(i, ARCHETYPES[(i - 1) % len(ARCHETYPES)], rng) for i in range(1, n + 1)]

    OUT_PATH.write_text(json.dumps(wells, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Wrote {n} wells -> {OUT_PATH}\n")

    print("Per incident type:")
    for k, v in Counter(w["incident_type"] for w in wells).most_common():
        print(f"  {k:<25} {v}")
    print("\nPer field:")
    for k, v in Counter(w["field_name"] for w in wells).most_common():
        print(f"  {k:<25} {v}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--n", type=int, default=60)
    args = parser.parse_args()
    main(args.n)