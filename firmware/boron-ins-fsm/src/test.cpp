#include <iostream>
#include <string>
#include <sstream> // for std::stringstream

int main()
{
    std::string str = "123"; // input string

    // create a string stream
    std::stringstream ss(str);

    // use string stream to convert the string to an integer
    int num;
    ss >> num;

    std::cout << "The integer value is: " << num << std::endl;

    return 0;
}