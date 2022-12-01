#ifndef MOCK_THREAD_H
#define MOCK_THREAD_H

struct os_thread_fn_t {};

class Thread
{
public:
    Thread() {}

public:
    Thread(const char* name, void (*)(void*)) {}
};

#endif