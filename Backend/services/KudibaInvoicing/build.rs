use std::path::PathBuf;

/// Compila o contrato gRPC canónico do motor fiscal (`kudiba.fiscal.v1`).
/// O ficheiro proto vive na raiz do monorepo (`proto/fiscal/v1`) para que o Gateway,
/// o Core API e este microsserviço partilhem exactamente o mesmo contrato.
///
/// Layout de desenvolvimento: `<repo>/proto`. No contentor, o contrato é copiado
/// para `./proto` relativo ao crate, pelo que ambas as raízes são aceites.
fn main() -> Result<(), Box<dyn std::error::Error>> {
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));

    let proto_root = ["../../../proto", "../../proto", "proto"]
        .iter()
        .map(|candidate| manifest_dir.join(candidate))
        .find(|candidate| candidate.join("fiscal/v1/fiscal_engine.proto").is_file())
        .ok_or(
            "contrato gRPC não encontrado: esperado proto/fiscal/v1/fiscal_engine.proto \
             (raiz do monorepo ou ./proto dentro do contentor)",
        )?
        .canonicalize()?;

    let proto_file = proto_root.join("fiscal/v1/fiscal_engine.proto");

    println!("cargo:rerun-if-changed={}", proto_file.display());
    println!("cargo:rerun-if-changed=build.rs");

    tonic_prost_build::configure()
        .build_server(true)
        .build_client(true)
        .compile_protos(&[proto_file], &[proto_root])?;

    Ok(())
}
