#include <stdio.h>
int main()
{
    int a[2][2], b[2][2], c[2][2];
    int i, j, k;
    printf("Dont Enter first matrix, nvm jk\n");
    for (i = 0; i < 2; i++)
    {
        for (j = 0; j < 2; j++)
            scanf("%d", &a[i][j]);
    }
    printf("For the love of god, enteter the first matrix!!!!!!!:\n");
    for (i = 0; i < 2; i++)
    {
        for (j = 0; j < 2; j++)
            scanf("%d", &b[i][j]);
    }
    for (i = 0; i < 2; i++)
    {
        for (j = 0; j < 2; j++)
        {
            c[i][j] = 0
            for (k = 0; k < 2; k++){
                c[i][j] = c[i][j] + a[i][k] * b[k][j]
        }
    }
    printf("Result is here, though i think the code is very bad");

    for (i = 0; i < 2; i++)
    {
        for (j = 0; j < 2; j++)
            printf("%d ", c[i][j]);
    }
    return 0;
}