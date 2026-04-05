cmake_minimum_required(VERSION 3.20)

project(celeste_pcg_generator LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

include(FetchContent)

set(PCG_CPP_VENDOR_DIR "${CMAKE_CURRENT_SOURCE_DIR}/third_party/pcg-cpp")

if (EXISTS "${PCG_CPP_VENDOR_DIR}/include/pcg_random.hpp")
    set(PCG_CPP_INCLUDE_DIR "${PCG_CPP_VENDOR_DIR}/include")
else()
    FetchContent_Declare(
        pcg_cpp
        GIT_REPOSITORY https://github.com/imneme/pcg-cpp.git
        GIT_TAG master
        GIT_SHALLOW TRUE
        GIT_SUBMODULES ""
        GIT_SUBMODULES_RECURSE FALSE
    )
    FetchContent_MakeAvailable(pcg_cpp)
    set(PCG_CPP_INCLUDE_DIR "${pcg_cpp_SOURCE_DIR}/include")
endif()

# FastNoiseLite - header-only noise generation library
set(FASTNOISELITE_VENDOR_DIR "${CMAKE_CURRENT_SOURCE_DIR}/third_party/FastNoiseLite")

if (EXISTS "${FASTNOISELITE_VENDOR_DIR}/Cpp/FastNoiseLite.h")
    set(FASTNOISELITE_INCLUDE_DIR "${FASTNOISELITE_VENDOR_DIR}/Cpp")
else()
    FetchContent_Declare(
        fastnoiselite
        GIT_REPOSITORY https://github.com/Auburn/FastNoiseLite.git
        GIT_TAG v1.1.1
        GIT_SHALLOW TRUE
        GIT_SUBMODULES ""
        GIT_SUBMODULES_RECURSE FALSE
    )
    FetchContent_MakeAvailable(fastnoiselite)
    set(FASTNOISELITE_INCLUDE_DIR "${fastnoiselite_SOURCE_DIR}/Cpp")
endif()

add_executable(celeste_pcg_generator
    src/main.cpp
    src/options.cpp
    src/topology.cpp
    src/room_renderer.cpp
    src/json_output.cpp
)

target_compile_features(celeste_pcg_generator PRIVATE cxx_std_17)
target_include_directories(celeste_pcg_generator PRIVATE
    "${PCG_CPP_INCLUDE_DIR}"
    "${FASTNOISELITE_INCLUDE_DIR}"
)

if (MSVC)
    target_compile_options(celeste_pcg_generator PRIVATE /W4 /EHsc)
else()
    target_compile_options(celeste_pcg_generator PRIVATE -Wall -Wextra -Wpedantic)
endif()