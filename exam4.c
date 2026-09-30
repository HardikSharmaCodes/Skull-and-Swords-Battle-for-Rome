#include <stdio.h>

int main()
{
    int a, b, c;
    int greatest, smallest;

    printf("Enter three numbers: ");
    scanf("%d %d %d", &a, &b, &c);

    int conduit = b;

    if (b > a){
        greatest = b;}
    else{
        greatest = a;}

    if (c > greatest){
        greatest = c;}

    if (b < a){
        smallest = b;}
    else{
        smallest = a;}

    if (c < smallest){
        smallest = c;}

    printf("Greatest = %d", greatest);
    printf("Smallest = %d", smallest);

    return 0;
}