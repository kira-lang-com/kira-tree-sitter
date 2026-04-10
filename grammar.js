const PREC = {
  CALL: 6,
  UNARY: 5,
  MULTIPLICATIVE: 4,
  ADDITIVE: 3,
  COMPARISON: 2,
};

module.exports = grammar({
  name: "kira",

  extras: ($) => [
    /\s/,
    $.comment,
  ],

  conflicts: ($) => [
    [$.return_statement],
    [$.let_statement],
    [$.assign_statement, $.expression_statement],
  ],

  rules: {
    source_file: ($) => repeat($.top_level_declaration),

    comment: () => token(seq("//", /.*/)),

    top_level_declaration: ($) => choice(
      $.import_statement,
      $.function_definition,
      $.type_definition,
      $.construct_definition,
      $.widget_instance,
    ),

    // import foo.bar as Alias
    import_statement: ($) => seq(
      "import",
      $.path,
      optional(seq("as", field("alias", $.identifier))),
    ),

    // construct Widget { annotations { ... } requires { ... } ... }
    construct_definition: ($) => seq(
      "construct",
      field("name", $.identifier),
      "{",
      repeat($.construct_block),
      "}",
    ),

    construct_block: ($) => seq(
      field("kind", $.identifier),
      "{",
      repeat($.construct_block_item),
      "}",
    ),

    construct_block_item: ($) => choice(
      seq($.attribute, ";"),
      seq($.identifier, $.parameter_list, $.block),
      seq($.identifier, ";"),
    ),

    // Widget Foo(params) { ... }
    widget_instance: ($) => seq(
      repeat($.attribute),
      field("widget", $.identifier),
      field("name", $.identifier),
      field("parameters", $.parameter_list),
      "{",
      repeat($.widget_body_item),
      "}",
    ),

    widget_body_item: ($) => choice(
      seq($.attribute, $.let_statement),
      seq($.attribute, ";"),
      $.let_statement,
      $.lifecycle_method,
      $.named_block,
    ),

    named_block: ($) => seq(
      field("name", $.identifier),
      "{",
      repeat($.statement),
      "}",
    ),

    lifecycle_method: ($) => seq(
      field("name", $.identifier),
      $.parameter_list,
      $.block,
    ),

    // type Foo { let x: Int ... }
    type_definition: ($) => seq(
      repeat($.attribute),
      "type",
      field("name", $.identifier),
      "{",
      repeat($.type_member),
      "}",
    ),

    type_member: ($) => choice(
      $.static_let_statement,
      $.let_statement,
      $.function_definition,
    ),

    static_let_statement: ($) => seq(
      "static",
      "let",
      field("name", $.identifier),
      optional(seq(":", field("type", $.type_expression))),
      "=",
      field("value", $.expression),
    ),

    // function foo(x: Int) -> Int { ... }
    // function foo(x: Int): Int;   (FFI extern)
    function_definition: ($) => seq(
      repeat($.attribute),
      "function",
      field("name", $.identifier),
      field("parameters", $.parameter_list),
      optional(seq("->", field("return_type", $.type_expression))),
      choice(
        field("body", $.block),
        ";",
      ),
    ),

    // @Foo or @Foo.Bar or @Foo { key: val; }
    attribute: ($) => seq(
      "@",
      field("name", $.attribute_path),
      optional(choice(
        $.attribute_arguments_block,
        $.attribute_arguments_paren,
      )),
    ),

    attribute_path: ($) => seq(
      $.attribute_identifier,
      repeat(seq(".", $.attribute_identifier)),
    ),

    attribute_arguments_block: ($) => seq(
      "{",
      optional(seq(
        $.attribute_argument,
        repeat(seq(";", $.attribute_argument)),
        optional(";"),
      )),
      "}",
    ),

    attribute_argument: ($) => seq(
      field("key", $.identifier),
      ":",
      field("value", $.expression),
    ),

    attribute_arguments_paren: ($) => seq(
      "(",
      optional(seq(
        $.attribute_argument,
        repeat(seq(",", $.attribute_argument)),
      )),
      ")",
    ),

    parameter_list: ($) => seq(
      "(",
      optional(seq(
        $.parameter,
        repeat(seq(",", $.parameter)),
      )),
      ")",
    ),

    // label: name: Type  OR  name: Type
    parameter: ($) => seq(
      field("name", $.identifier),
      ":",
      field("type", $.type_expression),
    ),

    type_expression: ($) => choice(
      $.builtin_type,
      $.path,
      seq("[", $.type_expression, "]"),
    ),

    builtin_type: () => choice(
      "Int", "Float", "Bool", "String",
      "Void", "RawPtr", "CString",
      "I8", "I16", "I32", "I64",
      "U8", "U16", "U32", "U64",
    ),

    block: ($) => seq(
      "{",
      repeat($.statement),
      "}",
    ),

    statement: ($) => choice(
      $.if_statement,
      $.for_statement,
      $.switch_statement,
      $.let_statement,
      $.assign_statement,
      $.return_statement,
      $.expression_statement,
    ),

    if_statement: ($) => seq(
      "if",
      field("condition", $.expression),
      field("consequence", $.block),
      optional(seq("else", field("alternative", choice($.block, $.if_statement)))),
    ),

    for_statement: ($) => seq(
      "for",
      field("variable", $.identifier),
      "in",
      field("iterable", $.expression),
      field("body", $.block),
    ),

    switch_statement: ($) => seq(
      "switch",
      field("value", $.expression),
      "{",
      repeat($.switch_case),
      optional($.switch_default),
      "}",
    ),

    switch_case: ($) => seq(
      "case",
      field("value", $.expression),
      field("body", $.block),
    ),

    switch_default: ($) => seq(
      "default",
      field("body", $.block),
    ),

    // let x: Int = 5  or  let x: Int  (no init, e.g. struct fields)
    let_statement: ($) => seq(
      "let",
      field("name", $.identifier),
      optional(seq(":", field("type", $.type_expression))),
      optional(seq("=", field("value", $.expression))),
      optional(";"),
    ),

    assign_statement: ($) => prec(1, seq(
      field("target", $.path),
      "=",
      field("value", $.expression),
      optional(";"),
    )),

    return_statement: ($) => seq(
      "return",
      optional(field("value", $.expression)),
      optional(";"),
    ),

    expression_statement: ($) => seq(
      $.expression,
      optional(";"),
    ),

    expression: ($) => choice(
      $.binary_expression,
      $.unary_expression,
      $.call_expression,
      $.path,
      $.literal,
      $.array_literal,
      seq("(", $.expression, ")"),
    ),

    call_expression: ($) => prec(PREC.CALL, seq(
      field("function", $.path),
      field("arguments", $.argument_list),
    )),

    argument_list: ($) => seq(
      "(",
      optional(seq(
        $.argument,
        repeat(seq(",", $.argument)),
      )),
      ")",
    ),

    argument: ($) => seq(
      optional(seq(field("label", $.identifier), ":")),
      field("value", $.expression),
    ),

    unary_expression: ($) => prec.right(PREC.UNARY, seq(
      field("operator", "-"),
      field("operand", $.expression),
    )),

    binary_expression: ($) => choice(
      ...[
        ["*", PREC.MULTIPLICATIVE],
        ["/", PREC.MULTIPLICATIVE],
        ["%", PREC.MULTIPLICATIVE],
        ["+", PREC.ADDITIVE],
        ["-", PREC.ADDITIVE],
        ["==", PREC.COMPARISON],
        ["!=", PREC.COMPARISON],
        ["<=", PREC.COMPARISON],
        [">=", PREC.COMPARISON],
        ["<", PREC.COMPARISON],
        [">", PREC.COMPARISON],
      ].map(([operator, precedence]) =>
        prec.left(precedence, seq(
          field("left", $.expression),
          field("operator", operator),
          field("right", $.expression),
        )),
      ),
    ),

    array_literal: ($) => seq(
      "[",
      optional(seq(
        $.expression,
        repeat(seq(",", $.expression)),
      )),
      "]",
    ),

    path: ($) => prec.left(seq(
      $.identifier,
      repeat(seq(".", $.member_identifier)),
    )),

    literal: ($) => choice(
      $.true,
      $.false,
      $.float_literal,
      $.integer_literal,
      $.string_literal,
    ),

    true: () => "true",
    false: () => "false",

    integer_literal: () => token(/[0-9]+/),
    float_literal: () => token(/[0-9]+\.[0-9]+/),

    string_literal: ($) => seq(
      "\"",
      repeat(choice(
        $.escape_sequence,
        token.immediate(prec(1, /[^"\\\n]+/)),
      )),
      "\"",
    ),

    escape_sequence: () => token.immediate(seq(
      "\\",
      choice('"', "\\", "n", "t", "r"),
    )),

    identifier: () => token(prec(-1, /[a-zA-Z_][a-zA-Z0-9_]*/)),
    member_identifier: () => token(prec(-1, /[a-zA-Z_][a-zA-Z0-9_]*/)),
    attribute_identifier: () => token(/[A-Z][a-zA-Z0-9_]*/),
  },
});
