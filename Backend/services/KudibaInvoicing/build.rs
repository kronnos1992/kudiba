fn main() -> Result<(), Box<dyn std::error::Error>> {
    let manifest_dir = std::env::var("CARGO_MANIFEST_DIR").unwrap_or_else(|_| ".".to_string());
    let manifest_dir = std::path::PathBuf::from(manifest_dir);

    let proto_root = ["../../../proto", "../../proto", "proto"]
        .iter()
        .map(|candidate| manifest_dir.join(candidate))
        .find(|candidate| candidate.join("fiscal/v1/fiscal_engine.proto").is_file())
        .ok_or(
            "contrato gRPC não encontrado: esperado proto/fiscal/v1/fiscal_engine.proto \
             (raiz do monorepo ou ./proto dentro do contentor)",
        )?;

    let proto_file = proto_root.join("fiscal/v1/fiscal_engine.proto");

    println!("cargo:rerun-if-changed={}", proto_file.display());
    println!("cargo:rerun-if-changed=build.rs");

    tonic_prost_build::configure()
        .build_server(true)
        .build_client(true)
        .compile_protos(&[proto_file], &[proto_root])?;

    Ok(())
}
