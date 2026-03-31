function buildFileMap() {
    return {
        'top.v': [
            "module top(input a, b, output sum, cout);",
            "  full_adder fa(.a(a), .b(b), .cin(1'b0), .sum(sum), .cout(cout));",
            "endmodule"
        ].join('\n'),
        'full_adder.v': [
            "module full_adder(input a, b, cin, output sum, cout);",
            "  assign sum  = a ^ b ^ cin;",
            "  assign cout = (a & b) | (b & cin) | (a & cin);",
            "endmodule"
        ].join('\n')
    }
}