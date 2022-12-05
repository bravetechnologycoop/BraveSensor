/*
 * Mock implementation for os queue functions and classes
 */

#pragma once

#include "mock_Particle.h"
#include <stdint.h>

typedef uint32_t system_tick_t;

typedef int os_result_t;

int os_queue_create(os_queue_t* queue, size_t item_size, size_t item_count, void* reserved);
int os_queue_take(os_queue_t queue, void* item, system_tick_t delay, void* reserved);
int os_queue_put(os_queue_t queue, const void* item, system_tick_t delay, void* reserved);
os_result_t os_thread_yield(void);

/* Return 0 on success for all functions */
int os_queue_create(os_queue_t* queue, size_t item_size, size_t item_count, void* reserved) {
    return 0;
}

int os_queue_take(os_queue_t queue, void* item, system_tick_t delay, void* reserved) {
    return 0;
}

int os_queue_put(os_queue_t queue, const void* item, system_tick_t delay, void* reserved) {
    return 0;
}

os_result_t os_thread_yield(void) {
    return 0;
}