#pragma once

struct os_thread_fn_t {};

class Thread
{
public:
    Thread() {}

public:
    Thread(const char* name, void (*)(void*)) {}
};