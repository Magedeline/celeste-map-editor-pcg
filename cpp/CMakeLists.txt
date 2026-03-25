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

add_executable(celeste_pcg_generator
    src/main.cpp
)

target_compile_features(celeste_pcg_generator PRIVATE cxx_std_17)
target_include_directories(celeste_pcg_generator PRIVATE "${PCG_CPP_INCLUDE_DIR}")

if (MSVC)
    target_compile_options(celeste_pcg_generator PRIVATE /W4 /EHsc)
else()
    target_compile_options(celeste_pcg_generator PRIVATE -Wall -Wextra -Wpedantic)
endif()