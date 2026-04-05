#ifndef CELESTE_PCG_ROOM_RENDERER_HPP
#define CELESTE_PCG_ROOM_RENDERER_HPP

#include "models.hpp"
#include "random.hpp"

std::string describeNodePhase(const TopologyNode& node, const GeneratedTopology& topology);
int getNodeSegment(const TopologyNode& node, const GeneratedTopology& topology);
ConnectionFlags getConnectionFlags(const TopologyNode& node, const Options& options);

Room makeRoom(const HouseKit& kit, RandomSource& random, const Options& options,
              const TopologyNode& node, const GeneratedTopology& topology,
              const ChapterArchetypeProfile& archetype);

Entity makeEntity(RandomSource& random, std::string name, int x, int y, int width = 8, int height = 8);

int getRoleColor(const std::string& role, RandomSource& random);

#endif // CELESTE_PCG_ROOM_RENDERER_HPP
