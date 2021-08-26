#pragma once
#include <string> 
using namespace std;

class MockString
{

public:

    std::string toString(MockString mockstring){
        char const* const s = (char const* const) mockstring;
        return std::string(mockstring.c_str());
    }

    int toInt(MockString string){
        std::string s = string.c_str();
        return std::stoi(s);
    }

};

extern MockString String;