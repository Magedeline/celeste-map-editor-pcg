#ifndef CELESTE_PCG_CATALOG_HPP
#define CELESTE_PCG_CATALOG_HPP

#include <algorithm>
#include <string>
#include <vector>

#include "models.hpp"

inline const std::vector<HouseKit> kHouseKits = {
    {"house", "House Kit", "house", '9', '1', 'a', '5', "resort", "event:/env/amb/04_main"},
    {"resort", "Resort Kit", "resort", '7', '6', '4', '5', "resort", "event:/env/amb/03_resort"},
    {"cliffside", "Cliffside Kit", "cliff", 'b', '8', '9', 'f', "cliffside", "event:/env/amb/02_awake"},
    {"kirby", "Kirby Kit", "kirby", 'c', '3', 'd', 'e', "lvl1", "event:/env/amb/01_main"},
    {"mario", "Mario Kit", "mario", '2', '4', '6', '8', "oldsite", "event:/env/amb/01_main"},
    {"metroidvania", "Metroidvania Kit", "metro", 'f', '2', '7', 'b', "temple", "event:/env/amb/05_mirror"},
    {"labybirth", "Labybirth Kit", "laby", '6', '1', '5', '9', "resort", "event:/env/amb/03_resort"},
    {"pizzatower", "Pizza Tower Kit", "pizza", 'd', '5', 'a', 'c', "mirror", "event:/env/amb/02_awake"},
    {"arcade", "Arcade Kit", "arcade", '3', '8', 'e', '4', "reflection", "event:/env/amb/05_mirror"},
};

inline const std::vector<ChapterArchetypeProfile> kChapterArchetypes = {
    {"linearAscent", "Linear Ascent", "celesteRandomizer", "vertical", true, false, true, false},
    {"longRunDensityBurst", "Long Run With Density Burst", "criticalPathBranches", "horizontal", true, false, true, true},
    {"spineCompactBranching", "Spine With Compact Branching", "criticalPathBranches", "", false, false, false, false},
    {"landmarkCorridor", "Landmark Corridor", "criticalPath", "horizontal", true, false, true, false},
    {"celesteCategory", "Celeste Category", "celesteRandomizer", "vertical", true, false, true, true},
    {"segmentedSummit", "Segmented Summit", "celesteRandomizer", "vertical", true, false, true, true},
};

inline const HouseKit& findKit(const std::string& id) {
    const auto iterator = std::find_if(kHouseKits.begin(), kHouseKits.end(), [&](const HouseKit& kit) {
        return kit.id == id;
    });
    return iterator != kHouseKits.end() ? *iterator : kHouseKits.front();
}

inline const ChapterArchetypeProfile& findArchetype(const std::string& id) {
    const auto iterator = std::find_if(kChapterArchetypes.begin(), kChapterArchetypes.end(), [&](const ChapterArchetypeProfile& archetype) {
        return archetype.id == id;
    });
    return iterator != kChapterArchetypes.end() ? *iterator : kChapterArchetypes.front();
}

#endif // CELESTE_PCG_CATALOG_HPP
