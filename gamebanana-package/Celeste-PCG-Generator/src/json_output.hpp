#ifndef CELESTE_PCG_JSON_OUTPUT_HPP
#define CELESTE_PCG_JSON_OUTPUT_HPP

#include <string>
#include <string_view>
#include <vector>

#include "models.hpp"

std::string escapeJson(std::string_view value);
std::string roomJson(const Room& room);
std::string previewMetadataJson(const GeneratedTopology& topology, const std::vector<Room>& rooms, const Options& options);

#endif // CELESTE_PCG_JSON_OUTPUT_HPP
