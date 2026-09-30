
#include <stdio.h>

float calculate(char op, float a, float b)
{
    if (op == '+'){
        return a + b;
    }
    else if (op == '-'){
        return a - b;}
    else if (op == '*'){
        return a * b;}
    else if (op == '/'){
        return a / b;}
    else{
        return 0;}
}

int main()
{
    char op;
    float a, b;

    printf("Enter operator: ");
    scanf(" %c", &op);

    printf("Enter two numbers: ");
    scanf("%f %f", &a, &b);

    printf("Result = %f", calculate(op, a, b));

    return 0;
}
