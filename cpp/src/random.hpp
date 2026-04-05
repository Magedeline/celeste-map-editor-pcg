#ifndef CELESTE_PCG_RANDOM_HPP
#define CELESTE_PCG_RANDOM_HPP

#include <cstdint>
#include <random>
#include <sstream>
#include <stdexcept>
#include <string>
#include <vector>

#include <pcg_random.hpp>
#include "models.hpp"

class RandomSource {
public:
    explicit RandomSource(const Options& options)
        : mode_(options.mode) {
        if (mode_ == "pseudo") {
            const std::uint64_t seed = options.hasSeed ? options.seed : 0u;
            pcg_.seed(seed, 0xda3e39cb94b95bdbULL);
            label_ = "seed=" + std::to_string(seed);
        } else {
            std::random_device device;
            trueSeed_ = (static_cast<std::uint64_t>(device()) << 32u) ^ static_cast<std::uint64_t>(device());
            engine_.seed(static_cast<std::mt19937::result_type>(trueSeed_ & 0xffffffffULL));
            std::ostringstream stream;
            stream << "crypto=" << std::hex << trueSeed_;
            label_ = stream.str();
        }
    }

    int nextInt(int upperExclusive) {
        if (upperExclusive <= 0) {
            throw std::runtime_error("upperExclusive must be positive");
        }

        if (mode_ == "pseudo") {
            std::uniform_int_distribution<int> distribution(0, upperExclusive - 1);
            return distribution(pcg_);
        }

        std::uniform_int_distribution<int> distribution(0, upperExclusive - 1);
        return distribution(engine_);
    }

    bool chance(double probability) {
        if (mode_ == "pseudo") {
            std::uniform_real_distribution<double> distribution(0.0, 1.0);
            return distribution(pcg_) < probability;
        }

        std::uniform_real_distribution<double> distribution(0.0, 1.0);
        return distribution(engine_) < probability;
    }

    template <typename T>
    const T& pickOne(const std::vector<T>& items) {
        if (items.empty()) {
            throw std::runtime_error("items must not be empty");
        }
        return items[static_cast<std::size_t>(nextInt(static_cast<int>(items.size())))];
    }

    const std::string& label() const {
        return label_;
    }

private:
    std::string mode_;
    std::string label_;
    pcg32 pcg_;
    std::mt19937 engine_;
    std::uint64_t trueSeed_ = 0u;
};

#endif // CELESTE_PCG_RANDOM_HPP
